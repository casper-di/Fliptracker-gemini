
import React, { useState } from 'react';
import { SyncStatus, UserPreferences } from '../types';

interface SettingsPageProps {
  status: SyncStatus;
  preferences: UserPreferences;
  onUpdatePreferences: (prefs: UserPreferences) => void;
  onNavigateToSync: () => void;
  onLogout: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ status, preferences, onUpdatePreferences, onNavigateToSync, onLogout }) => {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
  const toggleNotifPref = (key: keyof UserPreferences['notifications']) => {
    onUpdatePreferences({
      ...preferences,
      notifications: { ...preferences.notifications, [key]: !preferences.notifications[key] }
    });
  };

  const connectedCount = status.connections.length;
  const anyConnected = connectedCount > 0;

  return (
    <div className="px-6 py-10 space-y-8 animate-in fade-in pb-32 overflow-y-auto no-scrollbar">
      <div>
        <h2 className="text-3xl font-black text-slate-900 dark:text-white leading-tight">Paramètres</h2>
        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mt-2">Configuration & Compte</p>
      </div>

      <section className="bg-white dark:bg-slate-800 rounded-[32px] p-6 shadow-sm border border-slate-100 dark:border-white/5 theme-transition">
        <p className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-6">Mon Compte</p>
        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 bg-slate-900 dark:bg-slate-700 text-white rounded-[20px] flex items-center justify-center shadow-lg">
             <i className="fas fa-user text-xl"></i>
          </div>
          <div>
            <h4 className="text-base font-black text-slate-900 dark:text-white truncate">Utilisateur Local</h4>
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500">Compte Invité</p>
          </div>
        </div>
        <button 
          onClick={async () => {
            setIsLoggingOut(true);
            await onLogout();
          }}
          disabled={isLoggingOut}
          className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:text-rose-600 rounded-2xl transition-all group disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <span className="text-xs font-black uppercase tracking-tight text-slate-900 dark:text-slate-200 group-hover:text-rose-600 flex items-center gap-3">
            {isLoggingOut ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-rose-300 border-t-rose-600 animate-spin"></div>
                Déconnexion...
              </>
            ) : (
              'Se déconnecter'
            )}
          </span>
          {!isLoggingOut && <i className="fas fa-sign-out-alt text-slate-300 dark:text-slate-700 group-hover:text-rose-400 transition-colors"></i>}
        </button>
      </section>

      <section className="bg-white dark:bg-slate-800 rounded-[32px] p-6 shadow-sm border border-slate-100 dark:border-white/5 theme-transition">
        <p className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-6">Synchronisation Email</p>
        <button 
          onClick={onNavigateToSync}
          className="w-full flex items-center justify-between p-1 group"
        >
          <div className="flex items-center gap-4">
             <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg ${anyConnected ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600' : 'bg-slate-100 dark:bg-slate-900 text-slate-400'}`}>
                <i className="fas fa-envelope-open-text"></i>
             </div>
             <div className="text-left">
                <p className="text-sm font-black text-slate-900 dark:text-white">Comptes liés ({connectedCount})</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-tight">
                  {anyConnected ? '🟢 Comptes actifs' : '🔴 Aucun compte'}
                </p>
             </div>
          </div>
          <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-900 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all">
             <i className="fas fa-chevron-right text-[10px]"></i>
          </div>
        </button>
      </section>

      <section className="bg-white dark:bg-slate-800 rounded-[32px] p-6 shadow-sm border border-slate-100 dark:border-white/5 theme-transition">
        <p className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-6">Notifications</p>
        <div className="space-y-6">
          {[
            { id: 'pushEnabled', label: 'Push Globales' },
            { id: 'pickupReminders', label: 'Rappels Pickup' },
            { id: 'deliveryToday', label: 'Livraison Aujourd\'hui' }
          ].map((item) => (
            <div key={item.id} className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900 dark:text-white">{item.label}</span>
              <button 
                onClick={() => toggleNotifPref(item.id as any)}
                className={`w-12 h-6 rounded-full transition-all relative ${preferences.notifications[item.id as keyof UserPreferences['notifications']] ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-900'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${preferences.notifications[item.id as keyof UserPreferences['notifications']] ? 'right-1' : 'left-1'}`}></div>
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white dark:bg-slate-800 rounded-[32px] p-6 shadow-sm border border-slate-100 dark:border-white/5 theme-transition">
        <p className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-6">Thème & Apparence</p>
        <div className="grid grid-cols-3 gap-3">
           {['light', 'dark', 'system'].map((t) => (
             <button 
              key={t}
              onClick={() => onUpdatePreferences({...preferences, theme: t as any})}
              className={`py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${preferences.theme === t ? 'bg-slate-900 dark:bg-white border-slate-900 dark:border-white text-white dark:text-slate-900 shadow-md' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-white/5 text-slate-400 dark:text-slate-600'}`}
             >
               {t}
             </button>
           ))}
        </div>
      </section>

      <div className="text-center py-6 opacity-30">
        <p className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-[0.3em] italic">FlipTracker v2.6.0</p>
      </div>
    </div>
  );
};
