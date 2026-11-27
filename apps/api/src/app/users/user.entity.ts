import { Column, Entity, ManyToOne, OneToMany } from 'typeorm';
import { UserRole } from 'models';
import { BaseEntity } from '../../database/base.entity';
import { AdoptionApplication } from '../adoptions/adoption-application.entity';
import { Shelter } from '../shelters/shelter.entity';

@Entity('users')
export class User extends BaseEntity {
  // Lowercased on write so the unique constraint is case-insensitive.
  @Column({
    type: 'varchar',
    length: 320,
    unique: true,
    transformer: { to: (v?: string) => v?.toLowerCase(), from: (v: string) => v },
  })
  email!: string;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'enum', enum: UserRole, enumName: 'user_role', default: UserRole.Adopter })
  role!: UserRole;

  // Set only for shelter staff.
  @ManyToOne(() => Shelter, (shelter) => shelter.staff, { nullable: true, onDelete: 'SET NULL' })
  shelter!: Shelter | null;

  @OneToMany(() => AdoptionApplication, (application) => application.applicant)
  applications!: AdoptionApplication[];
}
