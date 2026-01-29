
import React, { useState } from 'react';
import { SyncStatus, UserPreferences, ConnectedEmail, EmailSummary, ParsedEmail, EmailLog } from '../types';

interface EmailSyncPageProps {
  status: SyncStatus;
  summary: EmailSummary;
  preferences: UserPreferences;
  onUpdatePreferences: (prefs: UserPreferences) => void;
  onSyncAction: (action: any, payload?: any) => void;
  onBack: () => void;
}

export const EmailSyncPage: React.FC<EmailSyncPageProps> = ({ status, summary, preferences, onUpdatePreferences, onSyncAction, onBack }) => {
  const [showLogs, setShowLogs] = useState(false);

  const toggleSyncPref = (key: keyof UserPreferences['sync']) => {
    onUpdatePreferences({
      ...preferences,
      sync: { ...preferences.sync, [key]: !preferences.sync[key] }
    });
  };

  const getStatusColor = (status: ConnectedEmail['status']) => {
    const normalized = status === 'active' ? 'connected' : status === 'revoked' ? 'error' : status;
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

  const getParsedStatusColor = (status: ParsedEmail['status']) => {
    switch (status) {
      case 'parsed': return 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400';
      case 'failed': return 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400';
      default: return 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400';
    }
  };

  const formatStatusLabel = (status: ConnectedEmail['status']) => {
    if (status === 'active') return 'connected';
    if (status === 'revoked') return 'error';
    return status;
  };

  return (
    <div className="bg-slate-50 dark:bg-slate-950 min-h-full flex flex-col animate-in slide-in-from-right duration-300">
      <header className="px-6 pt-12 pb-6 flex items-center gap-4 sticky top-0 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-md z-40 theme-transition">
        <button onClick={onBack} className="w-10 h-10 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 flex items-center justify-center active:scale-90 transition-all shadow-sm">
          <i className="fas fa-chevron-left text-xs dark:text-white"></i>
        </button>
        <h2 className="text-xl font-black text-slate-900 dark:text-white">Connected Emails</h2>
      </header>

      <div className="px-6 pb-32 space-y-6 overflow-y-auto no-scrollbar">
        {/* Connected Emails Summary */}
        <section className="bg-white dark:bg-slate-800 rounded-[32px] p-6 shadow-sm border border-slate-100 dark:border-white/5">
          <div className="flex items-center justify-between mb-5">
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">Connected Emails</p>
            <button
              onClick={() => onSyncAction('manual_sync')}
              className="text-[9px] font-black uppercase tracking-widest bg-slate-900 dark:bg-blue-600 text-white px-4 py-2 rounded-xl active:scale-95 transition-all"
            >
              Synchroniser
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-50 dark:bg-slate-900/60 rounded-2xl p-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-600">Comptes</p>
              <p className="text-lg font-black text-slate-900 dark:text-white">{summary.stats.totalConnections}</p>
              <p className="text-[9px] font-bold text-emerald-500">{summary.stats.connected} actifs</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900/60 rounded-2xl p-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-600">Analysés</p>
              <p className="text-lg font-black text-slate-900 dark:text-white">{summary.stats.emailsAnalyzed}</p>
              <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500">emails</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900/60 rounded-2xl p-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-600">Dernier sync</p>
              <p className="text-[11px] font-black text-slate-900 dark:text-white">
                {summary.stats.lastSyncAt
                  ? new Date(summary.stats.lastSyncAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : 'Jamais'}
              </p>
              <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500">
                {summary.stats.lastSyncAt
                  ? new Date(summary.stats.lastSyncAt).toLocaleDateString()
                  : 'Aucune synchro'}
              </p>
            </div>
          </div>
        </section>

        {/* Connection List */}
        <section className="space-y-3">
          <div className="flex justify-between items-center mb-1 px-1">
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">Comptes connectés</p>
            {status.isLoading && <i className="fas fa-circle-notch animate-spin text-blue-500 text-xs"></i>}
          </div>

          {status.connections.length === 0 ? (
            <div className="bg-white dark:bg-slate-900/50 rounded-[32px] p-10 text-center border border-slate-100 dark:border-white/5 border-dashed">
              <i className="fas fa-envelope-open text-slate-200 dark:text-slate-800 text-3xl mb-4"></i>
              <p className="text-xs font-bold text-slate-400 dark:text-slate-600">Aucun compte Gmail ou Outlook n'est actuellement lié.</p>
            </div>
          ) : (
            status.connections.map(conn => (
              <div key={conn.id} className="bg-white dark:bg-slate-800 rounded-[28px] p-5 shadow-sm border border-slate-100 dark:border-white/5 flex flex-col gap-4">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <img 
                      src={conn.provider === 'gmail' ? 'https://www.google.com/favicon.ico' : 'https://www.microsoft.com/favicon.ico'} 
                      className="w-8 h-8 rounded-lg" 
                      alt={conn.provider} 
                    />
                    <div>
                      <p className="text-sm font-black text-slate-900 dark:text-white truncate max-w-[180px]">{conn.emailAddress}</p>
                      <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 mt-1 rounded-md text-[8px] font-black uppercase tracking-tight ${getStatusColor(conn.status)}`}>
                        <span className={`w-1 h-1 rounded-full ${conn.status === 'connected' || conn.status === 'active' ? 'bg-emerald-500' : 'bg-current'}`}></span>
                        {formatStatusLabel(conn.status)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] font-black text-slate-400 dark:text-slate-600 uppercase mb-0.5">Dernier scan</p>
                    <p className="text-[10px] font-bold text-slate-900 dark:text-white">
                      {conn.lastSyncAt ? new Date(conn.lastSyncAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Jamais'}
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-2 pt-2 border-t border-slate-50 dark:border-white/5">
                  <button 
                    onClick={() => onSyncAction('reconnect', conn.id)}
                    className="flex-1 bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all"
                  >
                    Re-lier
                  </button>
                  <button 
                    onClick={() => onSyncAction('delete', conn.id)}
                    className="flex-1 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            ))
          )}

          <button 
            onClick={() => onSyncAction('connect_gmail')}
            className="w-full bg-slate-900 dark:bg-blue-600 text-white p-5 rounded-[24px] flex items-center justify-center gap-3 active:scale-[0.98] transition-all shadow-xl shadow-slate-200 dark:shadow-none"
          >
            <i className="fas fa-plus-circle opacity-50"></i>
            <span className="text-[11px] font-black uppercase tracking-widest">Ajouter un nouveau email</span>
          </button>
        </section>

        {/* Recently Parsed Emails */}
        <section className="space-y-3">
          <div className="flex justify-between items-center mb-1 px-1">
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">Emails analysés récemment</p>
            <span className="text-[9px] font-black text-slate-400 dark:text-slate-600">{summary.recentParsed.length}</span>
          </div>

          {summary.recentParsed.length === 0 ? (
            <div className="bg-white dark:bg-slate-900/50 rounded-[32px] p-8 text-center border border-slate-100 dark:border-white/5 border-dashed">
              <i className="fas fa-inbox text-slate-200 dark:text-slate-800 text-3xl mb-4"></i>
              <p className="text-xs font-bold text-slate-400 dark:text-slate-600">Aucun email analysé pour le moment.</p>
            </div>
          ) : (
            summary.recentParsed.map(email => (
              <div key={email.id} className="bg-white dark:bg-slate-800 rounded-[28px] p-5 shadow-sm border border-slate-100 dark:border-white/5 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-sm font-black text-slate-900 dark:text-white line-clamp-2">{email.subject}</p>
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500">{email.from}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-tight ${getParsedStatusColor(email.status)}`}>
                    {email.status}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 text-[9px] font-bold text-slate-500 dark:text-slate-400">
                  {email.marketplace && <span className="bg-slate-50 dark:bg-slate-900/60 px-2 py-1 rounded-lg">{email.marketplace}</span>}
                  {email.carrier && <span className="bg-slate-50 dark:bg-slate-900/60 px-2 py-1 rounded-lg">{email.carrier}</span>}
                  {email.trackingNumber && <span className="bg-slate-50 dark:bg-slate-900/60 px-2 py-1 rounded-lg">{email.trackingNumber}</span>}
                  {email.orderId && <span className="bg-slate-50 dark:bg-slate-900/60 px-2 py-1 rounded-lg">Commande {email.orderId}</span>}
                </div>
                <div className="text-[9px] font-bold text-slate-400 dark:text-slate-500">
                  Reçu le {new Date(email.receivedAt).toLocaleDateString()} à {new Date(email.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))
          )}
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
