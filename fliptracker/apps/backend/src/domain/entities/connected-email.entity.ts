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
  
  // Email sync tracking
  initialSyncCompleted?: boolean;
  initialSyncCompletedAt?: Date;

  // Webhook metadata
  gmailHistoryId?: string;
  gmailWatchExpiration?: Date;
  outlookSubscriptionId?: string;
  outlookSubscriptionExpiresAt?: Date;
  outlookClientState?: string;
}
