export interface User {
  id: string;
  email: string;
  provider: 'google' | 'microsoft';
  createdAt: Date;
}
