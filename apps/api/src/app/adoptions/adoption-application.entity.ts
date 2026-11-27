import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { AdoptionApplicationStatus } from 'models';
import { BaseEntity } from '../../database/base.entity';
import { Pet } from '../pets/pet.entity';
import { User } from '../users/user.entity';

@Entity('adoption_applications')
@Index(['pet', 'applicant'], { unique: true })
export class AdoptionApplication extends BaseEntity {
  // RESTRICT keeps adoption history: pets and users with applications can't be deleted.
  @ManyToOne(() => Pet, (pet) => pet.applications, { nullable: false, onDelete: 'RESTRICT' })
  pet!: Pet;

  @Index()
  @ManyToOne(() => User, (user) => user.applications, { nullable: false, onDelete: 'RESTRICT' })
  applicant!: User;

  @Column({
    type: 'enum',
    enum: AdoptionApplicationStatus,
    enumName: 'adoption_application_status',
    default: AdoptionApplicationStatus.Submitted,
  })
  status!: AdoptionApplicationStatus;

  @Column({ type: 'text', nullable: true })
  message!: string | null;
}
