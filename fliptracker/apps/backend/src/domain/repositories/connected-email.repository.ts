import { ConnectedEmail } from '../entities/connected-email.entity';

export interface IConnectedEmailRepository {
  findAll(): Promise<ConnectedEmail[]>;
  findById(id: string): Promise<ConnectedEmail | null>;
  findByUserId(userId: string): Promise<ConnectedEmail[]>;
  findByEmailAddress(emailAddress: string): Promise<ConnectedEmail | null>;
  findByEmailAddressAndProvider(emailAddress: string, provider: ConnectedEmail['provider']): Promise<ConnectedEmail | null>;
  findByOutlookSubscriptionId(subscriptionId: string): Promise<ConnectedEmail | null>;
  create(email: Omit<ConnectedEmail, 'id' | 'createdAt'>): Promise<ConnectedEmail>;
  update(id: string, data: Partial<ConnectedEmail>): Promise<ConnectedEmail>;
  delete(id: string): Promise<void>;
}

export const CONNECTED_EMAIL_REPOSITORY = Symbol('CONNECTED_EMAIL_REPOSITORY');
