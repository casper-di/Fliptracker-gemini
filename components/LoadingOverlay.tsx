
import React, { useState, useEffect } from 'react';

const MESSAGES = [
  "Initialisation de l'IA...",
  "Analyse de vos transporteurs...",
  "Sécurisation de la connexion...",
  "Indexation des derniers colis...",
  "Optimisation de l'interface..."
];

export const LoadingOverlay: React.FC = () => {
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIdx((prev) => (prev + 1) % MESSAGES.length);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 bg-white dark:bg-slate-950 z-[100] flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
      <div className="relative mb-8">
        <div className="w-20 h-20 rounded-[28px] bg-slate-900 dark:bg-blue-600 flex items-center justify-center text-white shadow-2xl animate-bounce">
           <i className="fas fa-box-open text-3xl"></i>
        </div>
        <div className="absolute inset-[-10px] border-2 border-slate-100 dark:border-white/5 rounded-[38px] animate-[spin_4s_linear_infinite]"></div>
      </div>
      
      <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2 tracking-tight italic">FlipTracker</h3>
      <div className="h-6 flex items-center justify-center overflow-hidden">
        <p key={msgIdx} className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] animate-in slide-in-from-bottom-2">
          {MESSAGES[msgIdx]}
        </p>
      </div>

      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-32 h-1.5 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
        <div className="h-full bg-blue-600 animate-[loading_2s_ease-in-out_infinite]"></div>
      </div>

      <style>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
};
