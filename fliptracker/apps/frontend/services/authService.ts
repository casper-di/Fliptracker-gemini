
/**
 * Backend-only authentication service.
 * 
 * Frontend does NOT initialize Firebase SDK directly.
 * All auth is handled by backend via HTTP APIs.
 * 
 * Flow:
 * 1. Frontend calls POST /api/auth/login with credentials
 * 2. Backend verifies with Firebase, returns session token
 * 3. Frontend stores token and includes in API requests
 * 4. Backend verifies token on each request via AuthGuard
 */

import { get, post } from './httpClient';

export interface AuthSession {
  uid: string;
  email: string;
  emailVerified: boolean;
  provider: 'google' | 'microsoft' | 'email';
}

/**
 * Login via backend (redirects to backend OAuth flow)
 */
export const signInWithGoogle = async (): Promise<void> => {
  // Backend redirects browser to Google OAuth, then back to frontend with token
  const response = await post('/auth/login/google', {}, { skipAuth: true });
  const data = await response.json();
  
  if (data.redirectUrl) {
    // Redirect browser to OAuth consent screen
    window.location.href = data.redirectUrl;
  }
};

/**
 * Get current session from backend
 */
export const getCurrentSession = async (): Promise<AuthSession | null> => {
  try {
    const response = await get('/auth/me', { skipAuth: false });
    if (response.status === 401) {
      return null; // Not logged in
    }
    const data = await response.json();
    return data.user || null;
  } catch (error) {
    console.error('Failed to get session:', error);
    return null;
  }
};

/**
 * Logout via backend
 */
export const signOut = async (): Promise<void> => {
  try {
    await post('/auth/logout', {});
  } catch (error) {
    console.error('Failed to logout:', error);
  }
};

/**
 * Subscribe to auth state changes
 * Backend session validation happens on each API call
 */
export const onAuthStateChange = (
  callback: (user: AuthSession | null) => void
): (() => void) => {
  let lastSession: AuthSession | null = null;
  
  // Check session on app load
  getCurrentSession().then(session => {
    lastSession = session;
    callback(session);
  });
  
  // Poll backend for session every 30 seconds (less aggressive)
  const interval = setInterval(async () => {
    try {
      const session = await getCurrentSession();
      // Only callback if session changed
      if (JSON.stringify(session) !== JSON.stringify(lastSession)) {
        lastSession = session;
        callback(session);
      }
    } catch (error) {
      console.error('Auth poll error:', error);
    }
  }, 30000);  // Changed from 5000 to 30000ms

  // Return unsubscribe function
  return () => clearInterval(interval);
};
