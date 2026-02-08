import { Shipment, SyncStatus, EmailSummary } from '../types';

const createStore = <T>(initialValue: T) => {
  let value = initialValue;
  const listeners = new Set<(next: T) => void>();

  return {
    get: () => value,
    set: (next: T) => {
      value = next;
      listeners.forEach(listener => listener(value));
    },
    update: (updater: (current: T) => T) => {
      value = updater(value);
      listeners.forEach(listener => listener(value));
    },
    subscribe: (listener: (next: T) => void) => {
      listeners.add(listener);
      listener(value);
      return () => listeners.delete(listener);
    },
  };
};

const INITIAL_SYNC_STATUS: SyncStatus = {
  connections: [],
  isLoading: false,
  error: null,
};

const INITIAL_EMAIL_SUMMARY: EmailSummary = {
  stats: {
    totalConnections: 0,
    connected: 0,
    expired: 0,
    error: 0,
    emailsAnalyzed: 0,
    lastSyncAt: null,
  },
  recentParsed: [],
  logs: [],
};

export const appStore = {
  shipments: createStore<Shipment[]>([]),
  syncStatus: createStore<SyncStatus>(INITIAL_SYNC_STATUS),
  emailSummary: createStore<EmailSummary>(INITIAL_EMAIL_SUMMARY),
};
