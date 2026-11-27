import { Column, Entity, Index, ManyToOne, OneToMany } from 'typeorm';
import { PetSex, PetSize, PetSpecies, PetStatus } from 'models';
import { BaseEntity } from '../../database/base.entity';
import { AdoptionApplication } from '../adoptions/adoption-application.entity';
import { Shelter } from '../shelters/shelter.entity';
import { PetPhoto } from './pet-photo.entity';

@Entity('pets')
@Index(['status', 'species'])
export class Pet extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'enum', enum: PetSpecies, enumName: 'pet_species' })
  species!: PetSpecies;

  @Column({ type: 'varchar', length: 100, nullable: true })
  breed!: string | null;

  @Column({ type: 'enum', enum: PetSex, enumName: 'pet_sex', default: PetSex.Unknown })
  sex!: PetSex;

  @Column({ type: 'enum', enum: PetSize, enumName: 'pet_size' })
  size!: PetSize;

  // Stored instead of age so it never goes stale; may be an estimate.
  @Column({ type: 'date', nullable: true })
  birthDate!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'enum', enum: PetStatus, enumName: 'pet_status', default: PetStatus.Available })
  status!: PetStatus;

  @Index()
  @ManyToOne(() => Shelter, (shelter) => shelter.pets, { nullable: false, onDelete: 'CASCADE' })
  shelter!: Shelter;

  @OneToMany(() => PetPhoto, (photo) => photo.pet)
  photos!: PetPhoto[];

  @OneToMany(() => AdoptionApplication, (application) => application.pet)
  applications!: AdoptionApplication[];
}
