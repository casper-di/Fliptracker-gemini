
import { ConnectedEmail, Shipment } from '../types';
import { get, post, del, patch } from './httpClient';

export interface ParcelFilters {
  type?: 'purchase' | 'sale';
  status?: string;
  provider?: 'gmail' | 'outlook';
  startDate?: string;
  endDate?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface ParcelResponse {
  data: Shipment[];
  total: number;
  limit: number;
  offset: number;
}

export const api = {
  // ========== EMAIL CONNECTIONS ==========
  // GET /api/emails
  getEmails: async (): Promise<ConnectedEmail[]> => {
    const response = await get('/emails');
    const data = await response.json();
    return data.emails || [];
  },

  // POST /api/emails/connect/:provider/start
  gmail: {
    connectStart: async () => {
      const response = await post('/emails/connect/gmail/start', {});
      return response.json();
    },
  },

  outlook: {
    connectStart: async () => {
      const response = await post('/emails/connect/outlook/start', {});
      return response.json();
    },
  },

  // DELETE /api/emails/:id
  deleteEmail: async (id: string): Promise<void> => {
    await del(`/emails/${id}`);
  },

  // POST /api/emails/:id/reconnect
  reconnectEmail: async (id: string): Promise<ConnectedEmail> => {
    const response = await post(`/emails/${id}/reconnect`, {});
    const data = await response.json();
    return data.authUrl ? { authUrl: data.authUrl } as any : data;
  },

  // ========== PARCELS ==========
  // GET /api/parcels
  getParcels: async (filters?: ParcelFilters): Promise<ParcelResponse> => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
    }
    const queryString = params.toString();
    const endpoint = queryString ? `/parcels?${queryString}` : '/parcels';
    const response = await get(endpoint);
    return response.json();
  },

  // GET /api/parcels/:id
  getParcelById: async (id: string): Promise<Shipment> => {
    const response = await get(`/parcels/${id}`);
    const data = await response.json();
    return data.parcel;
  },

  // POST /api/parcels
  createParcel: async (parcel: Omit<Shipment, 'id' | 'createdAt' | 'updatedAt'>): Promise<Shipment> => {
    const response = await post('/parcels', parcel);
    const data = await response.json();
    return data.parcel;
  },

  // PATCH /api/parcels/:id
  updateParcel: async (id: string, updates: Partial<Shipment>): Promise<Shipment> => {
    const response = await patch(`/parcels/${id}`, updates);
    const data = await response.json();
    return data.parcel;
  },

  // DELETE /api/parcels/:id
  deleteParcel: async (id: string): Promise<void> => {
    await del(`/parcels/${id}`);
  },

  // ========== EMAIL EVENTS ==========
  // GET /api/email-events
  getEmailEvents: async (filters?: any): Promise<any> => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
    }
    const queryString = params.toString();
    const endpoint = queryString ? `/email-events?${queryString}` : '/email-events';
    const response = await get(endpoint);
    return response.json();
  },

  // GET /api/email-events/pending/list
  getPendingEmailEvents: async (limit: number = 100): Promise<any> => {
    const response = await get(`/email-events/pending/list?limit=${limit}`);
    return response.json();
  },

  // DELETE /api/email-events/:id
  deleteEmailEvent: async (id: string): Promise<void> => {
    await del(`/email-events/${id}`);
  },
};
