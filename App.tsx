
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Shipment, ShipmentStatus, ShipmentDirection, TabType, AppNotification, UserPreferences, SyncStatus } from './types';
import { parseEmailContent } from './services/geminiService';
import { generateMockShipments } from './services/mockDataService';
import { ShipmentCard } from './components/ShipmentCard';
import { ShipmentDetailsPage } from './components/ShipmentDetailsPage';
import { BottomNav } from './components/BottomNav';
import { AddShipmentPage } from './components/AddShipmentPage';
import { NotificationPage } from './components/NotificationPage';
import { SettingsPage } from './components/SettingsPage';
import { EmailSyncPage } from './components/EmailSyncPage';
import { LandingPage } from './components/LandingPage';
import { AuthPage } from './components/AuthPage';
import { LoadingOverlay } from './components/LoadingOverlay';

const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'light',
  displayMode: 'comfortable',
  notifications: {
    pushEnabled: true,
    pickupReminders: true,
    imminentReturnAlerts: true,
    newShipmentDetected: true,
    deliveryToday: true
  },
  sync: {
    autoScan: true,
    weeklyRescan: false,
    includeSpams: false,
    restrictedSenders: true
  }
};

const INITIAL_SYNC_STATUS: SyncStatus = {
  state: 'disconnected', // Modifié par défaut pour montrer l'alerte au premier démarrage
  provider: null,
  lastSyncAt: null,
  detectedCount: 0,
  email: null
};

const App: React.FC = () => {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('incoming');
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'urgent' | 'transit'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Auth States
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authView, setAuthView] = useState<'landing' | 'login' | 'signup'>('landing');
  const [appLoading, setAppLoading] = useState<boolean>(true);

  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(INITIAL_SYNC_STATUS);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Persistence & Initial Mocks
  useEffect(() => {
    const savedAuth = localStorage.getItem('fliptracker_auth');
    if (savedAuth === 'true') setIsAuthenticated(true);

    const saved = localStorage.getItem('fliptracker_shipments');
    const savedNotifs = localStorage.getItem('fliptracker_notifications');
    const savedPrefs = localStorage.getItem('fliptracker_preferences');
    const savedSync = localStorage.getItem('fliptracker_sync');
    
    if (saved) {
      try { setShipments(JSON.parse(saved)); } catch (e) { console.error(e); }
    } else {
      setShipments(generateMockShipments(100));
    }

    if (savedNotifs) {
      try { setNotifications(JSON.parse(savedNotifs)); } catch (e) { console.error(e); }
    } else {
      setNotifications([
        { id: 'n1', title: 'Bienvenue sur FlipTracker', message: 'Votre interface de suivi a été mise à jour avec une gestion complète du mode sombre.', timestamp: new Date().toISOString(), type: 'info', read: false },
        { id: 'n2', title: 'Retrait urgent', message: 'Un colis Zalando SE arrive à échéance demain.', timestamp: new Date(Date.now() - 3600000).toISOString(), type: 'urgent', read: false },
      ]);
    }

    if (savedPrefs) {
      try { setPreferences(JSON.parse(savedPrefs)); } catch (e) { console.error(e); }
    }

    if (savedSync) {
      try { setSyncStatus(JSON.parse(savedSync)); } catch (e) { console.error(e); }
    }

    // Initial Splash timeout
    setTimeout(() => setAppLoading(false), 2500);
  }, []);

  useEffect(() => {
    localStorage.setItem('fliptracker_shipments', JSON.stringify(shipments));
    localStorage.setItem('fliptracker_notifications', JSON.stringify(notifications));
    localStorage.setItem('fliptracker_preferences', JSON.stringify(preferences));
    localStorage.setItem('fliptracker_auth', isAuthenticated.toString());
    localStorage.setItem('fliptracker_sync', JSON.stringify(syncStatus));
  }, [shipments, notifications, preferences, isAuthenticated, syncStatus]);

  const isDarkMode = preferences.theme === 'dark' || (preferences.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const filteredShipments = useMemo(() => {
    let list = [...shipments];
    if (activeTab === 'history') {
      list = list.filter(s => [ShipmentStatus.DELIVERED, ShipmentStatus.CANCELLED, ShipmentStatus.RETURNED_TO_SENDER].includes(s.status));
    } else if (activeTab === 'incoming') {
      list = list.filter(s => s.direction === ShipmentDirection.INBOUND && ![ShipmentStatus.DELIVERED, ShipmentStatus.CANCELLED, ShipmentStatus.RETURNED_TO_SENDER].includes(s.status));
    } else if (activeTab === 'outgoing') {
      list = list.filter(s => s.direction === ShipmentDirection.OUTBOUND && ![ShipmentStatus.DELIVERED, ShipmentStatus.CANCELLED, ShipmentStatus.RETURNED_TO_SENDER].includes(s.status));
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(s => s.sender.toLowerCase().includes(q) || s.trackingNumber.toLowerCase().includes(q) || s.carrier.toLowerCase().includes(q));
    }

    if (filterType === 'urgent') {
      list = list.filter(s => s.status === ShipmentStatus.PICKUP_AVAILABLE || s.status === ShipmentStatus.DELAYED);
    } else if (filterType === 'transit') {
      list = list.filter(s => s.status === ShipmentStatus.IN_TRANSIT || s.status === ShipmentStatus.OUT_FOR_DELIVERY);
    }

    return list.sort((a, b) => {
      const priority = (s: Shipment) => {
        if (s.status === ShipmentStatus.PICKUP_AVAILABLE) return -2000000000000 + (s.pickupInfo?.deadlineDate ? new Date(s.pickupInfo.deadlineDate).getTime() : 0);
        if (s.status === ShipmentStatus.DELAYED) return -1000000000000;
        return 0;
      };
      const pA = priority(a);
      const pB = priority(b);
      return pA !== pB ? pA - pB : (new Date(a.estimatedDelivery || 0).getTime() - new Date(b.estimatedDelivery || 0).getTime());
    });
  }, [shipments, activeTab, searchQuery, filterType]);

  const handleSyncAction = (action: string) => {
    if (action === 'restart') {
      setIsRefreshing(true);
      setTimeout(() => {
        setIsRefreshing(false);
        setSyncStatus(prev => ({ ...prev, state: 'connected', lastSyncAt: new Date().toISOString() }));
      }, 1500);
    } else if (action === 'pause') {
      setSyncStatus(prev => ({ ...prev, state: 'paused' }));
    } else if (action === 'disconnect') {
      setSyncStatus({ state: 'disconnected', provider: null, lastSyncAt: null, detectedCount: 0, email: null });
    } else if (action.startsWith('connect_')) {
      const provider = action.split('_')[1] as any;
      setSyncStatus({
        state: 'connected',
        provider,
        lastSyncAt: new Date().toISOString(),
        detectedCount: 42,
        email: 'user@example.com'
      });
    }
  };

  const handleAuthComplete = () => {
    setAppLoading(true);
    setTimeout(() => {
      setIsAuthenticated(true);
      setAppLoading(false);
    }, 2500);
  };

  // Auth Layout
  if (appLoading) return <LoadingOverlay />;

  if (!isAuthenticated) {
    if (authView === 'landing') {
      return <LandingPage onGetStarted={() => setAuthView('signup')} onLogin={() => setAuthView('login')} />;
    }
    return <AuthPage onAuthComplete={handleAuthComplete} onBack={() => setAuthView('landing')} />;
  }

  // Dashboard Layout
  if (selectedShipment) {
    return (
      <div className={isDarkMode ? 'dark' : ''}>
        <div className="bg-slate-50 dark:bg-slate-950 min-h-screen max-w-md mx-auto shadow-2xl relative overflow-hidden ring-1 ring-slate-200 dark:ring-white/10 theme-transition">
          <ShipmentDetailsPage 
            shipment={selectedShipment} 
            onBack={() => setSelectedShipment(null)} 
            allShipments={shipments}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={isDarkMode ? 'dark' : ''}>
      <div className="bg-slate-50 dark:bg-slate-950 min-h-screen flex flex-col max-w-md mx-auto shadow-2xl relative overflow-hidden ring-1 ring-slate-200 dark:ring-white/10 theme-transition">
        
        {activeTab !== 'email_sync' && (
          <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-5 pt-8 pb-4 sticky top-0 z-40 border-b border-slate-100 dark:border-white/10 shadow-sm theme-transition">
            <div className="flex justify-between items-center mb-5">
              <div onClick={() => setActiveTab('incoming')} className="cursor-pointer">
                <h1 className="text-2xl font-black text-slate-900 dark:text-white leading-none tracking-tight italic">FlipTracker</h1>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1.5 flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${syncStatus.state === 'connected' ? 'bg-emerald-500' : 'bg-amber-400'}`}></span>
                  {syncStatus.state === 'connected' ? 'Synchronisé' : 'Scan en pause'}
                </p>
              </div>
              <button 
                onClick={() => setActiveTab(activeTab === 'add' ? 'incoming' : 'add')} 
                className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg transition-all group ${activeTab === 'add' ? 'bg-slate-100 dark:bg-slate-800 text-slate-400' : 'bg-slate-900 dark:bg-blue-600 text-white active:scale-90'}`}
              >
                <i className={`fas fa-plus text-lg transition-transform duration-300 ${activeTab === 'add' ? 'rotate-45' : ''}`}></i>
              </button>
            </div>
            
            {['incoming', 'outgoing', 'history'].includes(activeTab) && (
              <>
                <div className="relative mb-4">
                  <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600"></i>
                  <input 
                    type="text" 
                    placeholder="Chercher un colis..." 
                    value={searchQuery} 
                    onChange={(e) => setSearchQuery(e.target.value)} 
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl py-3.5 pl-11 pr-4 text-[13px] font-semibold focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-400 dark:text-white" 
                  />
                </div>
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                  {[{ id: 'all', label: 'Tout', icon: 'fa-box' }, { id: 'urgent', label: 'Urgent', icon: 'fa-bolt-lightning' }, { id: 'transit', label: 'Transit', icon: 'fa-truck' }].map(f => (
                    <button 
                      key={f.id} 
                      onClick={() => setFilterType(f.id as any)} 
                      className={`flex items-center gap-2 whitespace-nowrap px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${filterType === f.id ? 'bg-slate-900 dark:bg-white border-slate-900 dark:border-white text-white dark:text-slate-950' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-white/5 text-slate-400 dark:text-slate-500'}`}
                    >
                      <i className={`fas ${f.icon} ${filterType === f.id ? 'text-blue-400 dark:text-blue-600' : 'text-slate-200 dark:text-slate-700'}`}></i>{f.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </header>
        )}

        <main 
          className={`flex-1 overflow-y-auto no-scrollbar relative ${activeTab === 'email_sync' ? '' : 'pb-32'}`}
        >
          {/* Alerte contextuelle pour la synchronisation mail */}
          {isAuthenticated && syncStatus.state === 'disconnected' && (activeTab === 'incoming' || activeTab === 'outgoing') && (
            <div className="px-5 pt-6 animate-in slide-in-from-top-4 duration-500">
              <div className="bg-blue-600 dark:bg-blue-700 rounded-[28px] p-6 shadow-xl shadow-blue-500/20 relative overflow-hidden group">
                <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-white/10 blur-3xl rounded-full group-hover:scale-150 transition-transform duration-1000"></div>
                
                <div className="flex items-start gap-5 relative z-10">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-white shrink-0">
                    <i className="fas fa-envelope-circle-check text-xl animate-pulse"></i>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-black text-white uppercase tracking-tight mb-1">Boîte mail non connectée</h3>
                    <p className="text-[11px] text-white/80 font-bold leading-relaxed mb-4">
                      Synchronisez votre compte pour détecter automatiquement vos prochains colis et profiter du suivi intelligent.
                    </p>
                    <button 
                      onClick={() => setActiveTab('email_sync')}
                      className="bg-white text-blue-600 px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-lg"
                    >
                      Connecter ma boîte
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'add' ? (
            <AddShipmentPage onBack={() => setActiveTab('incoming')} onSubmit={(data) => { setShipments(prev => [{...generateMockShipments(1)[0], ...data}, ...prev]); setActiveTab('incoming'); }} />
          ) : activeTab === 'notifications' ? (
            <NotificationPage 
              notifications={notifications} 
              onMarkAsRead={(id) => setNotifications(n => n.map(notif => notif.id === id ? { ...notif, read: true } : notif))}
              onClearAll={() => setNotifications([])}
            />
          ) : activeTab === 'settings' ? (
            <SettingsPage 
              status={syncStatus}
              preferences={preferences}
              onUpdatePreferences={setPreferences}
              onNavigateToSync={() => setActiveTab('email_sync')}
              onLogout={() => {
                setIsAuthenticated(false);
                setAuthView('landing');
                setSyncStatus({ state: 'disconnected', provider: null, lastSyncAt: null, detectedCount: 0, email: null });
              }}
            />
          ) : activeTab === 'email_sync' ? (
            <EmailSyncPage 
              status={syncStatus}
              preferences={preferences}
              onUpdatePreferences={setPreferences}
              onSyncAction={handleSyncAction}
              onBack={() => setActiveTab('settings')}
            />
          ) : (
            <div className="px-5 py-6">
              {filteredShipments.length === 0 ? (
                <div className="text-center py-24 opacity-50">
                  <i className="fas fa-box-archive text-4xl mb-4 text-slate-300 dark:text-slate-700"></i>
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Aucun colis trouvé</p>
                </div>
              ) : (
                filteredShipments.map(s => (
                  <div key={s.id} className="animate-in fade-in slide-in-from-bottom-2">
                    <ShipmentCard shipment={s} onClick={setSelectedShipment} />
                  </div>
                ))
              )}
            </div>
          )}
        </main>

        {activeTab !== 'email_sync' && (
          <BottomNav activeTab={activeTab} onTabChange={setActiveTab} unreadCount={notifications.filter(n => !n.read).length} />
        )}
      </div>
    </div>
  );
};

export default App;
