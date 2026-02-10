
import React, { useState } from 'react';
import { SyncStatus, UserPreferences, ConnectedEmail, EmailSummary, EmailLog } from '../types';

interface EmailSyncPageProps {
  status: SyncStatus;
  summary: EmailSummary;
  preferences: UserPreferences;
  onUpdatePreferences: (prefs: UserPreferences) => void;
  onSyncAction: (action: any, payload?: any) => void;
  onBack: () => void;
}

const EMAIL_PROVIDERS = [
  { id: 'gmail', name: 'Gmail', icon: 'https://www.google.com/favicon.ico', color: 'bg-red-50 dark:bg-red-500/10', action: 'connect_gmail' },
  { id: 'outlook', name: 'Outlook', icon: 'https://www.microsoft.com/favicon.ico', color: 'bg-blue-50 dark:bg-blue-500/10', action: 'connect_outlook' },
  { id: 'yahoo', name: 'Yahoo Mail', icon: 'https://www.yahoo.com/favicon.ico', color: 'bg-purple-50 dark:bg-purple-500/10', action: null },
  { id: 'icloud', name: 'iCloud Mail', icon: 'https://www.apple.com/favicon.ico', color: 'bg-slate-50 dark:bg-slate-800', action: null },
  { id: 'proton', name: 'ProtonMail', icon: 'https://proton.me/favicon.ico', color: 'bg-indigo-50 dark:bg-indigo-500/10', action: null },
];

export const EmailSyncPage: React.FC<EmailSyncPageProps> = ({ status, summary, preferences, onUpdatePreferences, onSyncAction, onBack }) => {
  const [showLogs, setShowLogs] = useState(false);
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);

  const toggleSyncPref = (key: keyof UserPreferences['sync']) => {
    onUpdatePreferences({
      ...preferences,
      sync: { ...preferences.sync, [key]: !preferences.sync[key] }
    });
  };

  const getStatusColor = (connStatus: ConnectedEmail['status']) => {
    const normalized = connStatus === 'active' ? 'connected' : connStatus === 'revoked' ? 'error' : connStatus;
    switch (normalized) {
      case 'connected': return 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400';
      case 'expired': return 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400';
      case 'error': return 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400';
      default: return 'bg-slate-50 text-slate-400 dark:bg-slate-800 dark:text-slate-500';
    }
  };

  const getLogColor = (level: EmailLog['level']) => {
    switch (level) {
      case 'error': return 'text-rose-400';
      case 'warn': return 'text-amber-400';
      default: return 'text-blue-400';
    }
  };

  const formatStatusLabel = (connStatus: ConnectedEmail['status']) => {
    if (connStatus === 'active') return 'Actif';
    if (connStatus === 'revoked') return 'Révoqué';
    if (connStatus === 'connected') return 'Connecté';
    if (connStatus === 'expired') return 'Expiré';
    if (connStatus === 'error') return 'Erreur';
    return connStatus;
  };

  const connectedCount = status.connections.length;

  return (
    <div className="bg-slate-50 dark:bg-slate-950 min-h-full flex flex-col animate-in slide-in-from-right duration-300">
      <header className="px-6 pt-12 pb-6 flex items-center gap-4 sticky top-0 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-md z-40 theme-transition">
        <button onClick={onBack} className="w-10 h-10 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 flex items-center justify-center active:scale-90 transition-all shadow-sm">
          <i className="fas fa-chevron-left text-xs dark:text-white"></i>
        </button>
        <div className="flex-1">
          <h2 className="text-xl font-black text-slate-900 dark:text-white">Emails connectés</h2>
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">
            {connectedCount} compte{connectedCount !== 1 ? 's' : ''} lié{connectedCount !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => onSyncAction('manual_sync')}
          disabled={status.isLoading}
          className="w-10 h-10 rounded-full bg-slate-900 dark:bg-blue-600 text-white flex items-center justify-center active:scale-90 transition-all shadow-sm disabled:opacity-60"
        >
          <i className={`fas fa-arrows-rotate text-xs ${status.isLoading ? 'animate-spin' : ''}`}></i>
        </button>
      </header>

      <div className="px-6 pb-32 space-y-6 overflow-y-auto no-scrollbar">

        {/* Connected Accounts List */}
        {status.connections.length > 0 && (
          <section className="space-y-3">
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest px-1">Comptes actifs</p>
            {status.connections.map(conn => (
              <div key={conn.id} className="bg-white dark:bg-slate-800 rounded-[24px] p-4 shadow-sm border border-slate-100 dark:border-white/5">
                <div className="flex items-center gap-3">
                  <img 
                    src={conn.provider === 'gmail' ? 'https://www.google.com/favicon.ico' : 'https://www.microsoft.com/favicon.ico'} 
                    className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900 p-2" 
                    alt={conn.provider} 
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-slate-900 dark:text-white truncate">{conn.emailAddress}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-tight ${getStatusColor(conn.status)}`}>
                        <span className={`w-1 h-1 rounded-full ${conn.status === 'connected' || conn.status === 'active' ? 'bg-emerald-500' : 'bg-current'}`}></span>
                        {formatStatusLabel(conn.status)}
                      </span>
                      {conn.lastSyncAt && (
                        <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500">
                          Sync {new Date(conn.lastSyncAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                  </div>
                  <button 
                    onClick={() => onSyncAction('delete', conn.id)}
                    className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-400 dark:text-slate-500 flex items-center justify-center hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10 dark:hover:text-rose-400 transition-all active:scale-90"
                  >
                    <i className="fas fa-trash-can text-[10px]"></i>
                  </button>
                </div>
              </div>
            ))}
          </section>
        )}

        {status.connections.length === 0 && (
          <div className="bg-white dark:bg-slate-900/50 rounded-[32px] p-10 text-center border border-slate-100 dark:border-white/5 border-dashed">
            <div className="w-16 h-16 bg-blue-50 dark:bg-blue-500/10 text-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <i className="fas fa-envelope-open text-2xl"></i>
            </div>
            <p className="text-sm font-black text-slate-900 dark:text-white mb-1">Aucun compte connecté</p>
            <p className="text-xs font-bold text-slate-400 dark:text-slate-600">Connectez un compte email pour détecter vos colis automatiquement</p>
          </div>
        )}

        {/* Add Provider Section */}
        <section className="space-y-3">
          <p className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest px-1">Ajouter un compte</p>
          <div className="space-y-2">
            {EMAIL_PROVIDERS.map((provider) => {
              const isAvailable = !!provider.action;
              return (
                <button
                  key={provider.id}
                  onClick={() => {
                    if (provider.action) {
                      setConnectingProvider(provider.id);
                      onSyncAction(provider.action);
                    }
                  }}
                  disabled={!isAvailable || connectingProvider === provider.id}
                  className={`w-full flex items-center gap-4 p-4 rounded-[20px] border transition-all ${
                    isAvailable
                      ? 'bg-white dark:bg-slate-800 border-slate-100 dark:border-white/5 active:scale-[0.98] hover:shadow-md shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-white/5 opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl ${provider.color} flex items-center justify-center p-2`}>
                    <img src={provider.icon} className="w-5 h-5" alt={provider.name} />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-black text-slate-900 dark:text-white">{provider.name}</p>
                    {!isAvailable && (
                      <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tight">Bientôt disponible</p>
                    )}
                  </div>
                  {connectingProvider === provider.id ? (
                    <i className="fas fa-circle-notch animate-spin text-blue-500 text-sm"></i>
                  ) : isAvailable ? (
                    <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
                      <i className="fas fa-plus text-[10px] text-slate-400 dark:text-slate-500"></i>
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                      <i className="fas fa-lock text-[10px] text-slate-300 dark:text-slate-600"></i>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Sync Preferences */}
        <section className="bg-white dark:bg-slate-800 rounded-[32px] p-6 shadow-sm border border-slate-100 dark:border-white/5">
          <p className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-6">Préférences de détection</p>
          <div className="space-y-6">
            {[
              { id: 'autoScan', label: 'Scan automatique', desc: 'Analyse les nouveaux emails en temps réel' },
              { id: 'weeklyRescan', label: 'Re-scan hebdomadaire', desc: 'Re-vérifie les anciens colis chaque semaine' },
              { id: 'includeSpams', label: 'Inclure les spams', desc: 'Certains colis peuvent finir en indésirables' }
            ].map(pref => (
              <div key={pref.id} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{pref.label}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">{pref.desc}</p>
                </div>
                <button 
                  onClick={() => toggleSyncPref(pref.id as any)}
                  className={`w-12 h-6 rounded-full transition-all relative ${preferences.sync[pref.id as keyof UserPreferences['sync']] ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-900'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${preferences.sync[pref.id as keyof UserPreferences['sync']] ? 'right-1' : 'left-1'}`}></div>
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Technical Logs */}
        <section className="bg-white dark:bg-slate-800 rounded-[32px] overflow-hidden border border-slate-100 dark:border-white/5 shadow-sm">
          <button onClick={() => setShowLogs(!showLogs)} className="w-full p-6 flex items-center justify-between">
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">Détails techniques & Logs</p>
            <i className={`fas fa-chevron-${showLogs ? 'up' : 'down'} text-[10px] text-slate-300`}></i>
          </button>
          
          {showLogs && (
            <div className="px-6 pb-6 space-y-4 animate-in fade-in slide-in-from-top-2">
              <div className="bg-slate-950 rounded-2xl p-4 font-mono text-[9px] text-blue-400 overflow-x-auto">
                {summary.logs.length === 0 ? (
                  <p className="opacity-50">Aucun log disponible pour le moment.</p>
                ) : (
                  summary.logs.map(log => (
                    <p key={log.id} className={`${getLogColor(log.level)} opacity-90`}>
                      [{new Date(log.createdAt).toLocaleTimeString()}] {log.message}
                    </p>
                  ))
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
