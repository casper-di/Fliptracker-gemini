
import React from 'react';
import { TabType } from '../types';

interface BottomNavProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  unreadCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange, unreadCount = 0 }) => {
  const tabs: { id: TabType; icon: string; label: string }[] = [
    { id: 'incoming', icon: 'fa-arrow-down-long', label: 'Incoming' },
    { id: 'outgoing', icon: 'fa-arrow-up-long', label: 'Outgoing' },
    { id: 'notifications', icon: 'fa-bell', label: 'Alerts' },
    { id: 'history', icon: 'fa-clock-rotate-left', label: 'History' },
    { id: 'settings', icon: 'fa-gear', label: 'Settings' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-t border-slate-100 dark:border-white/10 flex justify-around items-center px-2 py-2 pb-6 z-50 shadow-[0_-4px_16px_rgba(0,0,0,0.04)] max-w-md mx-auto theme-transition">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex flex-col items-center justify-center flex-1 gap-1.5 py-2 transition-all relative ${
            activeTab === tab.id ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-600'
          }`}
        >
          <i className={`fas ${tab.icon} text-lg ${activeTab === tab.id ? 'scale-110 drop-shadow-sm' : ''}`}></i>
          <span className="text-[9px] font-black uppercase tracking-widest">{tab.label}</span>
          {tab.id === 'notifications' && unreadCount > 0 && (
            <span className="absolute top-2 right-1/4 w-4 h-4 bg-rose-500 text-white text-[8px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900">
              {unreadCount}
            </span>
          )}
        </button>
      ))}
    </nav>
  );
};
