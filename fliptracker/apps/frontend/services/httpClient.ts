/**
 * HTTP client with automatic Bearer token injection.
 * Tokens are retrieved from backend session endpoint.
 */

// Utiliser l'URL backend configurée (Render.com ou autre)
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://fliptracker-gemini.onrender.com/api';

interface HttpOptions extends RequestInit {
  skipAuth?: boolean;
}

const decodeJwtPayload = (token: string): { exp?: number } | null => {
  try {
    const payload = token.split('.')[1];
    if (!payload) {
      return null;
    }

    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + (4 - (normalized.length % 4 || 4)) % 4, '=');
    const json = atob(padded);
    return JSON.parse(json);
  } catch (error) {
    console.error('Failed to decode JWT payload:', error);
    return null;
  }
};

const isTokenExpiringSoon = (token: string, skewSeconds = 300): boolean => {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) {
    return false;
  }

  const expiresAtMs = payload.exp * 1000;
  return expiresAtMs <= Date.now() + skewSeconds * 1000;
};

/**
 * Retrieve ID token from backend session
 */
const getIdToken = async (): Promise<string | null> => {
  try {
    // Prefer token stored in localStorage (cross-origin safe)
    const storedToken = localStorage.getItem('auth_token');
    if (storedToken) {
      if (!isTokenExpiringSoon(storedToken)) {
        return storedToken;
      }

      const refreshedToken = await refreshIdToken();
      if (refreshedToken) {
        return refreshedToken;
      }
    }

    // Fallback to backend session cookie
    const response = await fetch(`${API_BASE_URL}/auth/token`, {
      method: 'GET',
      credentials: 'include', // Include cookies if session is stored in httpOnly cookie
    });
    
    if (response.status === 401) {
      return null;
    }
    
    const data = await response.json();
    if (data.token) {
      localStorage.setItem('auth_token', data.token);
    }
    return data.token || null;
  } catch (error) {
    console.error('Failed to get ID token:', error);
    return null;
  }
};

/**
 * Refresh ID token using backend refresh endpoint
 */
const refreshIdToken = async (): Promise<string | null> => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });

    if (!response.ok) {
      localStorage.removeItem('auth_token');
      return null;
    }

    const data = await response.json();
    if (data.token) {
      localStorage.setItem('auth_token', data.token);
    }
    return data.token || null;
  } catch (error) {
    console.error('Failed to refresh ID token:', error);
    localStorage.removeItem('auth_token');
    return null;
  }
};

export const httpClient = async (endpoint: string, options: HttpOptions = {}): Promise<Response> => {
  const url = `${API_BASE_URL}${endpoint}`;
  const { skipAuth = false, ...fetchOptions } = options;

  const headers = new Headers(fetchOptions.headers);

  if (!skipAuth) {
    const token = await getIdToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const response = await fetch(url, {
    ...fetchOptions,
    headers,
    credentials: 'include', // Include cookies for session-based auth
  });

  // Handle 401: session expired, try to refresh and retry once
  if (response.status === 401 && !skipAuth) {
    const refreshedToken = await refreshIdToken();
    if (refreshedToken) {
      headers.set('Authorization', `Bearer ${refreshedToken}`);
      return fetch(url, {
        ...fetchOptions,
        headers,
        credentials: 'include',
      });
    }
  }

  return response;
};

export const get = (endpoint: string, options: HttpOptions = {}) => 
  httpClient(endpoint, { ...options, method: 'GET' });

export const post = (endpoint: string, body?: any, options: HttpOptions = {}) => 
  httpClient(endpoint, { ...options, method: 'POST', body: body ? JSON.stringify(body) : undefined, headers: { 'Content-Type': 'application/json', ...options.headers } });

export const patch = (endpoint: string, body?: any, options: HttpOptions = {}) => 
  httpClient(endpoint, { ...options, method: 'PATCH', body: body ? JSON.stringify(body) : undefined, headers: { 'Content-Type': 'application/json', ...options.headers } });

export const put = (endpoint: string, body?: any, options: HttpOptions = {}) => 
  httpClient(endpoint, { ...options, method: 'PUT', body: body ? JSON.stringify(body) : undefined, headers: { 'Content-Type': 'application/json', ...options.headers } });

export const del = (endpoint: string, options: HttpOptions = {}) => 
  httpClient(endpoint, { ...options, method: 'DELETE' });