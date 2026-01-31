import React from 'react';

interface SyncIndicatorProps {
  isLoading: boolean;
}

export const SyncIndicator: React.FC<SyncIndicatorProps> = ({ isLoading }) => {
  if (!isLoading) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 animate-in slide-in-from-top duration-300">
      <div className="bg-blue-600 dark:bg-blue-700 text-white px-6 py-3 flex items-center justify-center gap-3 shadow-lg">
        <div className="relative">
          <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>
        </div>
        <span className="text-xs font-bold">
          Synchronisation en cours...
        </span>
      </div>
    </div>
  );
};
