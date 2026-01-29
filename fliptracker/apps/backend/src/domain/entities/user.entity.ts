export interface User {
  id: string;
  email: string;
  provider: 'google' | 'microsoft' | 'email';
  emailVerified?: boolean;
  createdAt: Date;
  
  // Email connections (for fetching emails)
  gmailConnected?: boolean;
  outlookConnected?: boolean;
  
  // Auth methods available (for login)
  passwordAuthEnabled?: boolean;
  googleOAuthEnabled?: boolean;
  outlookOAuthEnabled?: boolean;
  
  // Last auth timestamps
  lastAuthAt?: Date;
  lastPasswordAuthAt?: Date;
  lastGoogleAuthAt?: Date;
  lastOutlookAuthAt?: Date;
}
