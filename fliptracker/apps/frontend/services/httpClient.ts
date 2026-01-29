/**
 * HTTP client with automatic Bearer token injection.
 * Tokens are retrieved from backend session endpoint.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://fliptracker-gemini.onrender.com/api';

interface HttpOptions extends RequestInit {
  skipAuth?: boolean;
}

/**
 * Retrieve ID token from backend session
 */
const getIdToken = async (): Promise<string | null> => {
  try {
    // Get token from backend's session endpoint
    const response = await fetch(`${API_BASE_URL}/auth/token`, {
      method: 'GET',
      credentials: 'include', // Include cookies if session is stored in httpOnly cookie
    });
    
    if (response.status === 401) {
      return null;
    }
    
    const data = await response.json();
    return data.token || null;
  } catch (error) {
    console.error('Failed to get ID token:', error);
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
    const refreshedToken = await getIdToken();
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