export interface User {
  id: string;
  email: string;
  provider: 'google' | 'microsoft' | 'email';
  emailVerified?: boolean;
  createdAt: Date;
  
  // Provider external IDs (for deduplication & account linking)
  // Maps provider name to their unique user ID (sub, oid, etc)
  providerIds?: Record<string, string>;
  
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
