export interface User {
  id: string;
  email: string;
  provider: 'google' | 'microsoft' | 'email';
  emailVerified?: boolean;
  createdAt: Date;
}
