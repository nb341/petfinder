import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../database/base.entity';
import { Pet } from './pet.entity';

@Entity('pet_photos')
export class PetPhoto extends BaseEntity {
  @Column({ type: 'varchar', length: 2048 })
  url!: string;

  @Column({ type: 'int', default: 0 })
  sortOrder!: number;

  @Index()
  @ManyToOne(() => Pet, (pet) => pet.photos, { nullable: false, onDelete: 'CASCADE' })
  pet!: Pet;
}
