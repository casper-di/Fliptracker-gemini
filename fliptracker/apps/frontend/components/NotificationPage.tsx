
import React from 'react';
import { AppNotification } from '../types';

interface NotificationPageProps {
  notifications: AppNotification[];
  onMarkAsRead: (id: string) => void;
  onClearAll: () => void;
  onSelectShipment?: (id: string) => void;
}

export const NotificationPage: React.FC<NotificationPageProps> = ({ 
  notifications, 
  onMarkAsRead, 
  onClearAll,
  onSelectShipment 
}) => {
  const sorted = [...notifications].sort((a, b) => {
    // Priority first, then timestamp
    if (a.type === 'urgent' && b.type !== 'urgent') return -1;
    if (a.type !== 'urgent' && b.type === 'urgent') return 1;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  return (
    <div className="px-5 py-6 space-y-6 animate-in fade-in">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-black text-slate-900 leading-none">Notifications</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Activités récentes</p>
        </div>
        {notifications.length > 0 && (
          <button 
            onClick={onClearAll}
            className="text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-rose-500 transition-colors"
          >
            Tout effacer
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-[32px] border border-slate-50">
          <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-200">
            <i className="fas fa-bell-slash text-2xl"></i>
          </div>
          <p className="text-xs font-bold text-slate-400">Aucune notification pour le moment.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((notif) => (
            <div 
              key={notif.id} 
              onClick={() => {
                onMarkAsRead(notif.id);
                if (notif.shipmentId && onSelectShipment) onSelectShipment(notif.shipmentId);
              }}
              className={`bg-white rounded-[24px] p-5 border-2 transition-all cursor-pointer ${notif.read ? 'border-slate-50 opacity-60' : notif.type === 'urgent' ? 'border-rose-100 bg-rose-50/10' : 'border-blue-50'}`}
            >
              <div className="flex gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  notif.type === 'urgent' ? 'bg-rose-500 text-white' : 
                  notif.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-blue-500 text-white'
                }`}>
                  <i className={`fas ${
                    notif.type === 'urgent' ? 'fa-bolt' : 
                    notif.type === 'success' ? 'fa-check' : 'fa-info'
                  }`}></i>
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="text-sm font-black text-slate-900">{notif.title}</h4>
                    <span className="text-[9px] font-black text-slate-300 uppercase">
                      {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-slate-500 leading-relaxed">{notif.message}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
