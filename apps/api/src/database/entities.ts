import { AdoptionApplication } from '../app/adoptions/adoption-application.entity';
import { PetPhoto } from '../app/pets/pet-photo.entity';
import { Pet } from '../app/pets/pet.entity';
import { Shelter } from '../app/shelters/shelter.entity';
import { User } from '../app/users/user.entity';

export const entities = [Shelter, Pet, PetPhoto, User, AdoptionApplication];
