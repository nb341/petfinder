export const testDatabaseUrl = () =>
  process.env.TEST_DATABASE_URL ?? 'postgresql://petfinder:petfinder@localhost:5432/petfinder_test';
