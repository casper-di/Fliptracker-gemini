
import { ConnectedEmail } from '../types';

const STORAGE_KEY = 'fliptracker_email_connections';

// Simulated DB logic
const getDb = (): ConnectedEmail[] => {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
};

const saveDb = (connections: ConnectedEmail[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(connections));
};

export const api = {
  // POST /api/gmail/connect/start
  gmail: {
    connectStart: async () => {
      console.log("[API] GET /api/gmail/connect/start");
      // Simulate returning an OAuth URL
      return { url: "#oauth-simulation" };
    },

    // POST /api/gmail/connect/callback
    connectCallback: async (code: string, email: string): Promise<ConnectedEmail> => {
      console.log("[API] POST /api/gmail/connect/callback", { code, email });
      
      const db = getDb();
      const existingIdx = db.findIndex(c => c.emailAddress === email && c.provider === 'gmail');
      
      const newConnection: ConnectedEmail = {
        id: existingIdx >= 0 ? db[existingIdx].id : Math.random().toString(36).substr(2, 9),
        userId: 'current-user',
        provider: 'gmail',
        emailAddress: email,
        accessToken: 'simulated_access_token_' + Math.random(),
        refreshToken: 'simulated_refresh_token_' + Math.random(),
        tokenExpiry: new Date(Date.now() + 3600000).toISOString(),
        scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
        status: 'connected',
        lastSyncAt: new Date().toISOString(),
        createdAt: existingIdx >= 0 ? db[existingIdx].createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (existingIdx >= 0) {
        db[existingIdx] = newConnection;
      } else {
        db.push(newConnection);
      }

      saveDb(db);
      return newConnection;
    }
  },

  // GET /api/emails
  getEmails: async (): Promise<ConnectedEmail[]> => {
    console.log("[API] GET /api/emails");
    return new Promise((resolve) => {
      setTimeout(() => resolve(getDb()), 500);
    });
  },

  // DELETE /api/emails/:id
  deleteEmail: async (id: string): Promise<void> => {
    console.log(`[API] DELETE /api/emails/${id}`);
    const db = getDb();
    const filtered = db.filter(c => c.id !== id);
    saveDb(filtered);
  },

  // POST /api/emails/:id/reconnect
  reconnectEmail: async (id: string): Promise<ConnectedEmail> => {
    console.log(`[API] POST /api/emails/${id}/reconnect`);
    const db = getDb();
    const idx = db.findIndex(c => c.id === id);
    if (idx === -1) throw new Error("Connection not found");
    
    db[idx] = {
      ...db[idx],
      status: 'connected',
      accessToken: 'refreshed_token_' + Math.random(),
      updatedAt: new Date().toISOString()
    };
    
    saveDb(db);
    return db[idx];
  }
};
