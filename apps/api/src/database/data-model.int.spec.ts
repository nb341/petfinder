import { join } from 'node:path';
import { defineFeature, loadFeature, DefineStepFunction } from 'jest-cucumber';
import { DataSource, QueryFailedError } from 'typeorm';
import { AdoptionApplicationStatus, PetSex, PetSize, PetSpecies, PetStatus, UserRole } from 'models';
import { AdoptionApplication } from '../app/adoptions/adoption-application.entity';
import { PetPhoto } from '../app/pets/pet-photo.entity';
import { Pet } from '../app/pets/pet.entity';
import { Shelter } from '../app/shelters/shelter.entity';
import { User } from '../app/users/user.entity';
import { dataSourceOptions } from './data-source';
import { testDatabaseUrl } from './testing/test-database';

const feature = loadFeature(join(__dirname, 'features/data-model.feature'));

defineFeature(feature, (test) => {
  let db: DataSource;
  let error: unknown;

  beforeAll(async () => {
    db = await new DataSource(dataSourceOptions({ url: testDatabaseUrl() })).initialize();
  });

  afterAll(() => db?.destroy());

  beforeEach(() => {
    error = undefined;
  });

  const attempt = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (e) {
      error = e;
    }
  };

  const tableExists = async (name: string) => {
    const [{ exists }] = await db.query(
      `select exists (select from information_schema.tables where table_schema = 'public' and table_name = $1)`,
      [name],
    );
    return exists as boolean;
  };

  const shelter = (name: string) =>
    db.getRepository(Shelter).save({
      name,
      email: 'hello@happypaws.org',
      city: 'Toronto',
      country: 'CA',
    });

  const dog = (name: string, s: Shelter | null) =>
    db.getRepository(Pet).save({
      name,
      species: PetSpecies.Dog,
      sex: PetSex.Male,
      size: PetSize.Medium,
      shelter: s as Shelter,
    });

  const user = (email: string) =>
    db.getRepository(User).save({ email, name: 'Sam', role: UserRole.Adopter });

  const apply = (applicantEmail: string, petName: string) =>
    db.getRepository(AdoptionApplication).save({
      applicant: { id: users.get(applicantEmail)?.id },
      pet: { id: pets.get(petName)?.id },
    });

  const shelters = new Map<string, Shelter>();
  const pets = new Map<string, Pet>();
  const users = new Map<string, User>();

  const givenEmptyMigratedDatabase = (given: DefineStepFunction) =>
    given('an empty database with all migrations applied', async () => {
      shelters.clear();
      pets.clear();
      users.clear();
      await db.dropDatabase();
      await db.runMigrations();
    });

  const givenShelterWithDog = (given: DefineStepFunction) =>
    given(/^a shelter "(.*)" with a dog named "(.*)"$/, async (shelterName: string, petName: string) => {
      shelters.set(shelterName, await shelter(shelterName));
      pets.set(petName, await dog(petName, shelters.get(shelterName) ?? null));
    });

  const givenAdopterWhoApplied = (and: DefineStepFunction) =>
    and(/^an adopter "(.*)" who has applied to adopt "(.*)"$/, async (email: string, petName: string) => {
      users.set(email, await user(email));
      await apply(email, petName);
    });

  const whenApplies = (when: DefineStepFunction) =>
    when(/^"(.*)" applies to adopt "(.*)"$/, async (email: string, petName: string) => {
      await attempt(() => apply(email, petName));
    });

  const thenRejected = (then: DefineStepFunction) =>
    then(/^the (save|delete) is rejected$/, () => {
      expect(error).toBeInstanceOf(QueryFailedError);
    });

  const tablesExist = async (list: string, expected: boolean) => {
    const names = list.split(',').map((t) => t.trim());
    const actual = Object.fromEntries(await Promise.all(names.map(async (t) => [t, await tableExists(t)])));
    expect(actual).toEqual(Object.fromEntries(names.map((t) => [t, expected])));
  };

  test('Migrations create the schema', ({ given, then }) => {
    givenEmptyMigratedDatabase(given);
    then(/^the tables "(.*)" exist$/, (list: string) => tablesExist(list, true));
  });

  test('A new pet is available by default', ({ given, when, then }) => {
    givenEmptyMigratedDatabase(given);
    given(/^a shelter "(.*)"$/, async (name: string) => {
      shelters.set(name, await shelter(name));
    });
    when(/^I add a dog named "(.*)" to "(.*)"$/, async (petName: string, shelterName: string) => {
      pets.set(petName, await dog(petName, shelters.get(shelterName) ?? null));
    });
    then(/^"(.*)" has status "(.*)"$/, async (petName: string, status: string) => {
      const pet = await db.getRepository(Pet).findOneByOrFail({ id: pets.get(petName)?.id });
      expect(pet.status).toBe(status as PetStatus);
    });
  });

  test('A pet must belong to a shelter', ({ given, when, then }) => {
    givenEmptyMigratedDatabase(given);
    when(/^I add a dog named "(.*)" without a shelter$/, async (petName: string) => {
      await attempt(() => dog(petName, null));
    });
    thenRejected(then);
  });

  test('Removing a shelter removes its pets and their photos', ({ given, when, then }) => {
    givenEmptyMigratedDatabase(given);
    given(
      /^a shelter "(.*)" with a dog named "(.*)" that has (\d+) photos$/,
      async (shelterName: string, petName: string, count: string) => {
        const s = await shelter(shelterName);
        shelters.set(shelterName, s);
        const pet = await dog(petName, s);
        for (let i = 0; i < Number(count); i++) {
          await db.getRepository(PetPhoto).save({ url: `https://cdn.example.com/${i}.jpg`, sortOrder: i, pet });
        }
      },
    );
    when(/^I delete the shelter "(.*)"$/, async (name: string) => {
      await db.getRepository(Shelter).delete({ id: shelters.get(name)?.id });
    });
    then('no pets or photos remain', async () => {
      expect(await db.getRepository(Pet).count()).toBe(0);
      expect(await db.getRepository(PetPhoto).count()).toBe(0);
    });
  });

  test('User emails are unique regardless of case', ({ given, when, then }) => {
    givenEmptyMigratedDatabase(given);
    given(/^a user with email "(.*)"$/, async (email: string) => {
      await user(email);
    });
    when(/^I add another user with email "(.*)"$/, async (email: string) => {
      await attempt(() => user(email));
    });
    thenRejected(then);
  });

  test('A new adoption application is submitted by default', ({ given, and, when, then }) => {
    givenEmptyMigratedDatabase(given);
    givenShelterWithDog(given);
    and(/^an adopter "(.*)"$/, async (email: string) => {
      users.set(email, await user(email));
    });
    when(/^"(.*)" applies to adopt "(.*)"$/, async (email: string, petName: string) => {
      await apply(email, petName);
    });
    then(/^the application has status "(.*)"$/, async (status: string) => {
      const [application] = await db.getRepository(AdoptionApplication).find();
      expect(application.status).toBe(status as AdoptionApplicationStatus);
    });
  });

  test('An adopter can apply only once per pet', ({ given, and, when, then }) => {
    givenEmptyMigratedDatabase(given);
    givenShelterWithDog(given);
    givenAdopterWhoApplied(and);
    whenApplies(when);
    thenRejected(then);
  });

  test('A pet with adoption applications cannot be deleted', ({ given, and, when, then }) => {
    givenEmptyMigratedDatabase(given);
    givenShelterWithDog(given);
    givenAdopterWhoApplied(and);
    when(/^I delete the pet "(.*)"$/, async (petName: string) => {
      await attempt(() => db.getRepository(Pet).delete({ id: pets.get(petName)?.id }));
    });
    thenRejected(then);
  });

  test('Migrations can be reverted', ({ given, when, then }) => {
    givenEmptyMigratedDatabase(given);
    when('I revert all migrations', async () => {
      const executed = async () => (await db.query('select count(*)::int as n from migrations'))[0].n as number;
      while ((await executed()) > 0) await db.undoLastMigration();
    });
    then(/^the tables "(.*)" do not exist$/, (list: string) => tablesExist(list, false));
  });
});
