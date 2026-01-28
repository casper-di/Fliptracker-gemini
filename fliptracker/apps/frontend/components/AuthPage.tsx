
import React, { useState } from 'react';
import { signInWithGoogle } from '../services/authService';

interface AuthPageProps {
  onAuthComplete: () => void;
  onBack: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onAuthComplete, onBack }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simuler un appel API
    setTimeout(() => {
      setLoading(false);
      onAuthComplete();
    }, 2000);
  };

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      await signInWithGoogle();
      onAuthComplete();
    } catch (error) {
      console.error('Google sign-in failed:', error);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col theme-transition">
      <header className="px-6 pt-12 pb-6 flex items-center relative z-10">
        <button onClick={onBack} className="w-10 h-10 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center border border-slate-100 dark:border-white/5 active:scale-90 transition-all">
          <i className="fas fa-arrow-left text-xs text-slate-900 dark:text-white"></i>
        </button>
      </header>

      <main className="flex-1 px-8 pt-6">
        <div className="mb-10">
          <h2 className="text-3xl font-black text-slate-900 dark:text-white leading-tight mb-2">
            {mode === 'login' ? 'Ravi de vous revoir' : 'Créer un compte'}
          </h2>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">
            {mode === 'login' ? 'Connectez-vous à votre espace' : 'Rejoignez FlipTracker aujourd\'hui'}
          </p>
        </div>

        <div className="flex bg-slate-200/50 dark:bg-slate-900 rounded-2xl p-1 mb-8">
          <button 
            onClick={() => setMode('login')}
            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'login' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`}
          >
            Connexion
          </button>
          <button 
            onClick={() => setMode('signup')}
            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'signup' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`}
          >
            Inscription
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase ml-2 tracking-widest">Nom complet</label>
              <input 
                type="text" 
                required
                placeholder="Ex: Jean Dupont"
                className="w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-[20px] py-4 px-6 text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all dark:text-white"
              />
            </div>
          )}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase ml-2 tracking-widest">Email</label>
            <input 
              type="email" 
              required
              placeholder="votre@email.com"
              className="w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-[20px] py-4 px-6 text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all dark:text-white"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase ml-2 tracking-widest">Mot de passe</label>
            <input 
              type="password" 
              required
              placeholder="••••••••"
              className="w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-[20px] py-4 px-6 text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all dark:text-white"
            />
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-slate-900 dark:bg-blue-600 text-white py-5 rounded-[24px] font-black text-sm uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {loading ? <i className="fas fa-circle-notch animate-spin"></i> : (mode === 'login' ? 'Se connecter' : 'C\'est parti')}
          </button>
        </form>

        <div className="mt-8">
          <div className="flex items-center gap-4 mb-8">
            <div className="flex-1 h-px bg-slate-200 dark:bg-white/5"></div>
            <span className="text-[10px] font-black text-slate-300 dark:text-slate-700 uppercase tracking-widest">Ou continuer avec</span>
            <div className="flex-1 h-px bg-slate-200 dark:bg-white/5"></div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button 
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="flex items-center justify-center gap-3 py-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-[20px] active:scale-95 transition-all disabled:opacity-50"
            >
              <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="Google" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Google</span>
            </button>
            <button className="flex items-center justify-center gap-3 py-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-[20px] active:scale-95 transition-all">
              <img src="https://www.microsoft.com/favicon.ico" className="w-4 h-4" alt="Outlook" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Outlook</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};
