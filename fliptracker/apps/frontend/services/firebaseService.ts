/**
 * DEPRECATED: Firebase SDK removed for security.
 * 
 * All authentication and database access now goes through backend APIs.
 * See authService.ts for backend-driven auth flow.
 * 
 * DO NOT IMPORT THIS FILE. Use authService.ts instead.
 */

// Firebase client SDK should NEVER be used in frontend
// All auth and DB access must go through backend HTTP APIs
// This file is kept only as a reminder of what was removed

export const deprecated = {
  message: 'Firebase SDK removed for security - use authService.ts instead',
};
