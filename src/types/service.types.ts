import { Timestamp } from 'firebase/firestore';
import { WithId } from './common.types';

export type ServiceCategory =
  | 'haircut'
  | 'beard'
  | 'combo'
  | 'treatment'
  | 'other';

/**
 * Firestore collection: `services`
 * Represents a service offered at the barbershop.
 */
export interface Service extends WithId {
  name: string;
  description: string;
  /** Price in the shop's local currency (integer cents or decimal dollars) */
  price: number;
  durationMinutes: number;
  category: ServiceCategory;
  imageURL: string | null;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type CreateServicePayload = Omit<
  Service,
  'id' | 'createdAt' | 'updatedAt'
>;

export type UpdateServicePayload = Partial<
  Pick<
    Service,
    | 'name'
    | 'description'
    | 'price'
    | 'durationMinutes'
    | 'category'
    | 'imageURL'
    | 'isActive'
  >
>;
