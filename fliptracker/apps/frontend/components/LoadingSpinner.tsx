import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  text?: string;
  fullScreen?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  text = 'Chargement...', 
  fullScreen = false 
}) => {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24'
  };

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
    xl: 'text-lg'
  };

  const spinner = (
    <div className="flex flex-col items-center justify-center gap-4">
      {/* Animated spinner */}
      <div className={`${sizeClasses[size]} relative`}>
        <div className="absolute inset-0 rounded-full border-4 border-slate-200 dark:border-slate-700"></div>
        <div className="absolute inset-0 rounded-full border-4 border-blue-600 dark:border-blue-500 border-t-transparent animate-spin"></div>
      </div>
      
      {/* Loading text */}
      {text && (
        <p className={`${textSizeClasses[size]} font-bold text-slate-600 dark:text-slate-400 animate-pulse`}>
          {text}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-slate-50 dark:bg-slate-950 flex items-center justify-center z-50 theme-transition">
        {spinner}
      </div>
    );
  }

  return spinner;
};

// Composant pour les sections qui chargent
export const LoadingSection: React.FC<{ text?: string }> = ({ text = 'Chargement...' }) => {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-[32px] p-12 shadow-sm border border-slate-100 dark:border-white/5 flex items-center justify-center">
      <LoadingSpinner size="md" text={text} />
    </div>
  );
};

// Composant pour les cartes qui chargent (skeleton)
export const LoadingCard: React.FC = () => {
  return (
    <div className="bg-white dark:bg-slate-800/80 rounded-[22px] mb-3 overflow-hidden shadow-sm border border-slate-100 dark:border-white/5 flex h-32 animate-pulse">
      <div className="w-1.5 h-full bg-slate-200 dark:bg-slate-700"></div>
      <div className="flex-1 p-4 flex flex-col justify-between">
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
          </div>
          <div className="w-20 h-6 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
        </div>
        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
        <div className="flex justify-between items-center">
          <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div>
          <div className="flex gap-2">
            <div className="w-7 h-7 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
            <div className="w-7 h-7 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
          </div>
        </div>
      </div>
    </div>
  );
};
