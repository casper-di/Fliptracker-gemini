
import React, { useState } from 'react';
import { SyncStatus, UserPreferences } from '../types';

interface EmailSyncPageProps {
  status: SyncStatus;
  preferences: UserPreferences;
  onUpdatePreferences: (prefs: UserPreferences) => void;
  onSyncAction: (action: 'restart' | 'pause' | 'connect_gmail' | 'connect_outlook' | 'disconnect') => void;
  onBack: () => void;
}

export const EmailSyncPage: React.FC<EmailSyncPageProps> = ({ status, preferences, onUpdatePreferences, onSyncAction, onBack }) => {
  const [showLogs, setShowLogs] = useState(false);

  const toggleSyncPref = (key: keyof UserPreferences['sync']) => {
    onUpdatePreferences({
      ...preferences,
      sync: {
        ...preferences.sync,
        [key]: !preferences.sync[key]
      }
    });
  };

  const getStatusBadge = () => {
    switch (status.state) {
      case 'connected':
        return <span className="px-2 py-1 bg-emerald-100 text-emerald-600 text-[9px] font-black uppercase rounded-md flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Connecté</span>;
      case 'paused':
        return <span className="px-2 py-1 bg-amber-100 text-amber-600 text-[9px] font-black uppercase rounded-md flex items-center gap-1.5">🟡 En pause</span>;
      default:
        return <span className="px-2 py-1 bg-slate-100 text-slate-400 text-[9px] font-black uppercase rounded-md flex items-center gap-1.5">🔴 Non connecté</span>;
    }
  };

  return (
    <div className="bg-slate-50 min-h-full flex flex-col animate-in slide-in-from-right duration-300">
      <header className="px-6 pt-12 pb-6 flex items-center gap-4 sticky top-0 bg-slate-50/80 backdrop-blur-md z-40">
        <button onClick={onBack} className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center active:scale-90 transition-all shadow-sm">
          <i className="fas fa-chevron-left text-xs"></i>
        </button>
        <h2 className="text-xl font-black text-slate-900">Synchronisation Email</h2>
      </header>

      <div className="px-6 pb-20 space-y-6">
        {/* Current State Card */}
        <section className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-100">
          <div className="flex justify-between items-start mb-6">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">État actuel</p>
              {status.email ? (
                <p className="text-sm font-bold text-slate-900">{status.email}</p>
              ) : (
                <p className="text-sm font-bold text-slate-400 italic">Aucun compte connecté</p>
              )}
            </div>
            {getStatusBadge()}
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-slate-50 p-4 rounded-2xl">
              <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Dernière analyse</p>
              <p className="text-[11px] font-bold text-slate-900">{status.lastSyncAt ? new Date(status.lastSyncAt).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl">
              <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Colis détectés</p>
              <p className="text-[11px] font-bold text-slate-900">{status.detectedCount} colis</p>
            </div>
          </div>

          <div className="space-y-3">
            {status.state === 'disconnected' ? (
              <>
                <button onClick={() => onSyncAction('connect_gmail')} className="w-full flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl hover:bg-slate-50 active:scale-[0.98] transition-all">
                  <div className="flex items-center gap-3">
                    <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Gmail" />
                    <span className="text-xs font-black text-slate-900 uppercase tracking-tight">Connecter Gmail</span>
                  </div>
                  <i className="fas fa-plus text-slate-300 text-xs"></i>
                </button>
                <button onClick={() => onSyncAction('connect_outlook')} className="w-full flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl hover:bg-slate-50 active:scale-[0.98] transition-all">
                  <div className="flex items-center gap-3">
                    <img src="https://www.microsoft.com/favicon.ico" className="w-5 h-5" alt="Outlook" />
                    <span className="text-xs font-black text-slate-900 uppercase tracking-tight">Connecter Outlook</span>
                  </div>
                  <i className="fas fa-plus text-slate-300 text-xs"></i>
                </button>
              </>
            ) : (
              <div className="flex gap-3">
                <button 
                  onClick={() => onSyncAction('restart')}
                  className="flex-1 bg-slate-900 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <i className="fas fa-sync-alt"></i> Analyser
                </button>
                <button 
                  onClick={() => onSyncAction(status.state === 'paused' ? 'restart' : 'pause')}
                  className="flex-1 bg-slate-100 text-slate-600 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
                >
                  {status.state === 'paused' ? 'Reprendre' : 'Suspendre'}
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Sync Preferences */}
        <section className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-100">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Préférences de détection</p>
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-900">Scan automatique</p>
                <p className="text-[10px] text-slate-400 font-medium">Analyse les nouveaux emails en temps réel</p>
              </div>
              <button 
                onClick={() => toggleSyncPref('autoScan')}
                className={`w-12 h-6 rounded-full transition-all relative ${preferences.sync.autoScan ? 'bg-blue-600' : 'bg-slate-200'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${preferences.sync.autoScan ? 'right-1' : 'left-1'}`}></div>
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-900">Re-scan hebdomadaire</p>
                <p className="text-[10px] text-slate-400 font-medium">Re-vérifie les anciens colis chaque semaine</p>
              </div>
              <button 
                onClick={() => toggleSyncPref('weeklyRescan')}
                className={`w-12 h-6 rounded-full transition-all relative ${preferences.sync.weeklyRescan ? 'bg-blue-600' : 'bg-slate-200'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${preferences.sync.weeklyRescan ? 'right-1' : 'left-1'}`}></div>
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-900">Inclure les spams</p>
                <p className="text-[10px] text-slate-400 font-medium">Certains colis peuvent finir en indésirables</p>
              </div>
              <button 
                onClick={() => toggleSyncPref('includeSpams')}
                className={`w-12 h-6 rounded-full transition-all relative ${preferences.sync.includeSpams ? 'bg-blue-600' : 'bg-slate-200'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${preferences.sync.includeSpams ? 'right-1' : 'left-1'}`}></div>
              </button>
            </div>
          </div>
        </section>

        {/* Technical Details */}
        <section className="bg-white rounded-[32px] overflow-hidden border border-slate-100 shadow-sm">
          <button 
            onClick={() => setShowLogs(!showLogs)}
            className="w-full p-6 flex items-center justify-between"
          >
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Détails techniques & Logs</p>
            <i className={`fas fa-chevron-${showLogs ? 'up' : 'down'} text-[10px] text-slate-300`}></i>
          </button>
          
          {showLogs && (
            <div className="px-6 pb-6 space-y-4 animate-in fade-in slide-in-from-top-2">
              <div className="bg-slate-900 rounded-2xl p-4 font-mono text-[9px] text-blue-400 overflow-x-auto">
                <p className="opacity-50">[14:32:01] Starting email sync sequence...</p>
                <p className="opacity-50">[14:32:05] Analyzing 42 new messages.</p>
                <p className="text-emerald-400">[14:32:12] Detected Shipment: AMZN-FR-4921</p>
                <p className="text-emerald-400">[14:32:15] Detected Shipment: ZALANDO-RT-901</p>
                <p className="opacity-50">[14:32:20] Sync completed. 2 found.</p>
              </div>
              <div className="space-y-2">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Dossiers indexés</p>
                <div className="flex flex-wrap gap-2">
                  {['Inbox', 'Updates', 'Purchases', 'Spam'].map(folder => (
                    <span key={folder} className="px-2 py-1 bg-slate-100 rounded-md text-[9px] font-bold text-slate-500">{folder}</span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Privacy Note */}
        <div className="bg-blue-50/50 rounded-3xl p-6 border border-blue-100">
           <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                 <i className="fas fa-shield-halved text-xs"></i>
              </div>
              <p className="text-xs font-black text-blue-900 uppercase tracking-tight">Confidentialité</p>
           </div>
           <p className="text-[10px] text-blue-800/70 leading-relaxed font-medium">
             FlipTracker ne lit que les emails de confirmation de commande et d'expédition. Aucun autre contenu n'est stocké ou analysé. Les accès peuvent être révoqués à tout moment.
           </p>
        </div>
      </div>
    </div>
  );
};
