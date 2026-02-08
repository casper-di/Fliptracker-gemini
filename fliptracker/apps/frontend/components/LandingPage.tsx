
import React from 'react';

interface LandingPageProps {
  onGetStarted: () => void;
  onLogin: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted, onLogin }) => {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 flex flex-col theme-transition overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-[-10%] left-[-20%] w-[80%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full"></div>
      <div className="absolute bottom-[-10%] right-[-20%] w-[80%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full"></div>

      <header className="px-6 pt-12 pb-6 flex justify-between items-center relative z-10">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white italic tracking-tighter">FlipTracker</h1>
        <button 
          onClick={onLogin}
          className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 hover:text-blue-600 transition-colors"
        >
          Connexion
        </button>
      </header>

      <main className="flex-1 flex flex-col px-8 pt-10 relative z-10">
        <div className="mb-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="w-16 h-16 bg-slate-900 dark:bg-blue-600 rounded-[24px] flex items-center justify-center text-white mb-8 shadow-2xl shadow-blue-500/20">
            <i className="fas fa-box-open text-2xl"></i>
          </div>
          <h2 className="text-5xl font-black text-slate-900 dark:text-white leading-[0.95] tracking-tighter mb-6">
            Vos colis,<br/>sans le <span className="text-blue-600">chaos</span>.
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-lg font-medium leading-relaxed max-w-[280px]">
            L'IA qui scanne vos emails et organise vos livraisons automatiquement.
          </p>
        </div>

        <div className="space-y-4 mb-12 animate-in fade-in slide-in-from-bottom-10 delay-200 fill-mode-both duration-700">
          {[
            { icon: 'fa-envelope-open-text', text: 'Sync Gmail & Outlook sans effort' },
            { icon: 'fa-qrcode', text: 'Pass de retrait centralisés' },
            { icon: 'fa-bolt-lightning', text: 'Alertes en temps réel' }
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-4 group">
              <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-slate-400 group-hover:text-blue-500 transition-colors">
                <i className={`fas ${item.icon} text-sm`}></i>
              </div>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{item.text}</span>
            </div>
          ))}
        </div>

        <div className="mb-10 animate-in fade-in slide-in-from-bottom-8 delay-300 fill-mode-both duration-700">
          <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">Connexion rapide</p>
          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={onLogin}
              className="flex flex-col items-center gap-2 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 text-slate-700 dark:text-slate-300 font-black text-[10px] uppercase tracking-widest shadow-sm active:scale-95 transition-all"
            >
              <i className="fab fa-apple text-lg"></i>
              Apple
            </button>
            <button
              type="button"
              onClick={onLogin}
              className="flex flex-col items-center gap-2 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 text-slate-700 dark:text-slate-300 font-black text-[10px] uppercase tracking-widest shadow-sm active:scale-95 transition-all"
            >
              <i className="fab fa-google text-lg"></i>
              Gmail
            </button>
            <button
              type="button"
              onClick={onLogin}
              className="flex flex-col items-center gap-2 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 text-slate-700 dark:text-slate-300 font-black text-[10px] uppercase tracking-widest shadow-sm active:scale-95 transition-all"
            >
              <i className="fab fa-microsoft text-lg"></i>
              Hotmail
            </button>
          </div>
        </div>

        <div className="mt-auto pb-12 animate-in fade-in slide-in-from-bottom-4 delay-500 fill-mode-both">
          <button 
            onClick={onGetStarted}
            className="w-full bg-slate-900 dark:bg-blue-600 text-white py-5 rounded-[24px] font-black text-sm uppercase tracking-widest shadow-2xl shadow-slate-200 dark:shadow-none active:scale-95 transition-all"
          >
            Commencer maintenant
          </button>
          <p className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-6">
            Gratuit pour vos 3 premiers suivis
          </p>
        </div>
      </main>
    </div>
  );
};
