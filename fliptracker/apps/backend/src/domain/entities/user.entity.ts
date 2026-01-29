export interface User {
  id: string;
  email: string;
  provider: 'google' | 'microsoft' | 'email';
  emailVerified?: boolean;
  gmailConnected?: boolean;
  outlookConnected?: boolean;
  createdAt: Date;
}
