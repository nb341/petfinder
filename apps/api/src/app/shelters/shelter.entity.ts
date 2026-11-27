import { Column, Entity, OneToMany } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { Pet } from '../pets/pet.entity';
import { User } from '../users/user.entity';

@Entity('shelters')
export class Shelter extends BaseEntity {
  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'varchar', length: 320 })
  email!: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  addressLine1!: string | null;

  @Column({ type: 'varchar', length: 100 })
  city!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  region!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  postalCode!: string | null;

  @Column({ type: 'char', length: 2, comment: 'ISO 3166-1 alpha-2' })
  country!: string;

  @OneToMany(() => Pet, (pet) => pet.shelter)
  pets!: Pet[];

  @OneToMany(() => User, (user) => user.shelter)
  staff!: User[];
}
