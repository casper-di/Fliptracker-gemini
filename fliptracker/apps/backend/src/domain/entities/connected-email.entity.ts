export type EmailProvider = 'gmail' | 'outlook';
export type ConnectionStatus = 'active' | 'expired' | 'revoked';

export interface ConnectedEmail {
  id: string;
  userId: string;
  provider: EmailProvider;
  emailAddress: string;
  refreshToken: string;
  accessToken: string;
  expiry: Date;
  status: ConnectionStatus;
  lastSyncAt: Date | null;
  createdAt: Date;
}
