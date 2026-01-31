
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Shipment, ShipmentStatus, ShipmentDirection, TabType, AppNotification, UserPreferences, SyncStatus, ConnectedEmail, EmailSummary } from './types';
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
import { LoadingSpinner, LoadingCard } from './components/LoadingSpinner';
import { api } from './services/apiService';
import { onAuthStateChange, signInWithGoogle, signOut, getCurrentSession } from './services/authService';

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
  connections: [],
  isLoading: false,
  error: null
};

const INITIAL_EMAIL_SUMMARY: EmailSummary = {
  stats: {
    totalConnections: 0,
    connected: 0,
    expired: 0,
    error: 0,
    emailsAnalyzed: 0,
    lastSyncAt: null,
  },
  recentParsed: [],
  logs: [],
};

const App: React.FC = () => {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [isLoadingShipments, setIsLoadingShipments] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('incoming');
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [showAuthPage, setShowAuthPage] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'urgent' | 'transit'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Auth States
  const [user, setUser] = useState<any>(null);
  const [appLoading, setAppLoading] = useState<boolean>(true);

  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(INITIAL_SYNC_STATUS);
  const [emailSummary, setEmailSummary] = useState<EmailSummary>(INITIAL_EMAIL_SUMMARY);

  // Capture token from OAuth callback (cross-origin safe)
  useEffect(() => {
    const url = new URL(window.location.href);
    console.log('App mounted, checking for token in URL:', {
      fullUrl: url.href,
      searchParams: Object.fromEntries(url.searchParams),
      hash: url.hash,
    });
    
    // Try query param first, then hash
    const tokenFromQuery = url.searchParams.get('token');
    const hashParams = new URLSearchParams(url.hash.replace('#', ''));
    const tokenFromHash = hashParams.get('token');
    const token = tokenFromQuery || tokenFromHash;

    console.log('Token search result:', { tokenFromQuery, tokenFromHash, token });

    if (token) {
      console.log('Token captured from URL, storing in localStorage');
      localStorage.setItem('auth_token', token);
      console.log('Token stored, value:', localStorage.getItem('auth_token'));
      
      // Clean up URL
      url.searchParams.delete('token');
      url.searchParams.delete('authenticated');
      url.hash = '';
      window.history.replaceState({}, document.title, url.pathname + url.search);
    } else {
      console.log('No token found in URL');
    }
  }, []);

  // Check for email OAuth callback (on mount and when URL changes)
  useEffect(() => {
    const checkEmailOAuthCallback = () => {
      const url = new URL(window.location.href);
      const emailSuccess = url.searchParams.get('success');
      const emailProvider = url.searchParams.get('provider');
      const emailError = url.searchParams.get('error');
      
      console.log('[Email OAuth] Checking for callback:', { emailSuccess, emailProvider, emailError });

      if (emailSuccess === 'true' && emailProvider) {
        console.log(`[Email OAuth] Callback detected for ${emailProvider}, will switch to email_sync tab`);
        // Store in sessionStorage to switch tab after user loads
        sessionStorage.setItem('pendingEmailSyncTab', 'true');
        
        // Clean up OAuth params from URL
        url.searchParams.delete('success');
        url.searchParams.delete('provider');
        url.searchParams.delete('error');
        window.history.replaceState({}, document.title, url.pathname + url.search);
      } else if (emailSuccess === 'false' && emailError) {
        console.error(`[Email OAuth] Callback failed: ${emailError}`);
        alert(`Failed to connect email: ${decodeURIComponent(emailError)}`);
        
        // Clean up error params
        url.searchParams.delete('success');
        url.searchParams.delete('provider');
        url.searchParams.delete('error');
        window.history.replaceState({}, document.title, url.pathname + url.search);
      }
    };

    checkEmailOAuthCallback();
    
    // Also check on URL change
    window.addEventListener('popstate', checkEmailOAuthCallback);
    return () => window.removeEventListener('popstate', checkEmailOAuthCallback);
  }, []);

  // Initial Data Loading
  useEffect(() => {
    const unsubscribe = onAuthStateChange((authSession) => {
      console.log('Auth state changed:', { hasUser: !!authSession });
      setUser(authSession);
      setAppLoading(false);

      // If pending email sync tab switch, do it now
      if (authSession && sessionStorage.getItem('pendingEmailSyncTab')) {
        console.log('Switching to email_sync tab after auth');
        sessionStorage.removeItem('pendingEmailSyncTab');
        setActiveTab('email_sync');
      }
    });

    const savedPrefs = localStorage.getItem('fliptracker_preferences');
    if (savedPrefs) {
      try { setPreferences(JSON.parse(savedPrefs)); } catch (e) { console.error(e); }
    }

    return unsubscribe;
  }, []);

  // Load parcels and connections when user changes
  useEffect(() => {
    if (user) {
      const loadData = async () => {
        setSyncStatus(prev => ({ ...prev, isLoading: true }));
        setIsLoadingShipments(true);
        try {
          // Load connected emails + summary
          const [connections, summary] = await Promise.all([
            api.getEmails(),
            api.getEmailSummary(),
          ]);
          setSyncStatus({ connections, isLoading: false, error: null });
          setEmailSummary(summary);

          // Load parcels from backend
          const response = await api.getParcels({ limit: 100, offset: 0 });
          setShipments(response.data || []);
        } catch (err) {
          console.error('Failed to load data:', err);
          setSyncStatus(prev => ({ ...prev, isLoading: false, error: 'Failed to load data' }));
        } finally {
          setIsLoadingShipments(false);
        }
      };
      loadData();
    }
  }, [user]);

  // Reload connections when email_sync tab becomes active (after OAuth redirect)
  useEffect(() => {
    if (user && activeTab === 'email_sync') {
      console.log('[Email Sync] Tab active and user loaded, reloading connections');
      const reloadConnections = async () => {
        setSyncStatus(prev => ({ ...prev, isLoading: true }));
        try {
          const [connections, summary] = await Promise.all([
            api.getEmails(),
            api.getEmailSummary(),
          ]);
          console.log('[Email Sync] Loaded', connections.length, 'connections');
          setSyncStatus({ connections, isLoading: false, error: null });
          setEmailSummary(summary);
        } catch (err) {
          console.error('Failed to reload email connections:', err);
          setSyncStatus(prev => ({ ...prev, isLoading: false }));
        }
      };
      reloadConnections();
    }
  }, [user, activeTab]);


  // Save State
  useEffect(() => {
    localStorage.setItem('fliptracker_shipments', JSON.stringify(shipments));
    localStorage.setItem('fliptracker_notifications', JSON.stringify(notifications));
    localStorage.setItem('fliptracker_preferences', JSON.stringify(preferences));
  }, [shipments, notifications, preferences]);

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

    return list.sort((a, b) => (new Date(a.lastUpdated).getTime() > new Date(b.lastUpdated).getTime() ? -1 : 1));
  }, [shipments, activeTab, searchQuery, filterType]);

  const handleSyncAction = async (action: string, payload?: any) => {
    setSyncStatus(prev => ({ ...prev, isLoading: true }));
    try {
      if (action === 'connect_gmail') {
        const { authUrl } = await api.gmail.connectStart();
        window.location.href = authUrl; // Redirect to OAuth
      } else if (action === 'connect_outlook') {
        const { authUrl } = await api.outlook.connectStart();
        window.location.href = authUrl; // Redirect to OAuth
      } else if (action === 'delete') {
        await api.deleteEmail(payload);
        setSyncStatus(prev => ({
          ...prev,
          connections: prev.connections.filter(c => c.id !== payload),
          isLoading: false
        }));
        const summary = await api.getEmailSummary();
        setEmailSummary(summary);
      } else if (action === 'reconnect') {
        const updated = await api.reconnectEmail(payload);
        setSyncStatus(prev => ({
          ...prev,
          connections: prev.connections.map(c => c.id === payload ? updated : c),
          isLoading: false
        }));
        const summary = await api.getEmailSummary();
        setEmailSummary(summary);
      } else if (action === 'manual_sync') {
        await api.syncEmails();
        const summary = await api.getEmailSummary();
        setEmailSummary(summary);
        
        // Reload shipments after sync to show new parcels
        const response = await api.getParcels({ limit: 100, offset: 0 });
        setShipments(response.data || []);
        
        setSyncStatus(prev => ({ ...prev, isLoading: false }));
      }
    } catch (err) {
      setSyncStatus(prev => ({ ...prev, isLoading: false, error: 'Operation failed' }));
    }
  };

  const handleShowLogin = () => {
    setShowAuthPage(true);
  };

  const handleAuthComplete = async () => {
    try {
      await signInWithGoogle();
      setShowAuthPage(false);
    } catch (error) {
      console.error('Sign in failed:', error);
    }
  };

  const handleBackFromAuth = () => {
    setShowAuthPage(false);
  };

  if (appLoading) return <LoadingOverlay />;

  if (!user) {
    if (showAuthPage) {
      return <AuthPage onAuthComplete={handleAuthComplete} onBack={handleBackFromAuth} />;
    }
    return <LandingPage onGetStarted={handleShowLogin} onLogin={handleShowLogin} />;
  }

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
                  <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${syncStatus.connections.some(c => c.status === 'connected' || c.status === 'active') ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                  {syncStatus.connections.length > 0 ? `${syncStatus.connections.length} comptes connectés` : 'Aucun compte mail'}
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

        <main className={`flex-1 overflow-y-auto no-scrollbar relative ${activeTab === 'email_sync' ? '' : 'pb-32'}`}>
          {user && syncStatus.connections.length === 0 && (activeTab === 'incoming' || activeTab === 'outgoing') && (
            <div className="px-5 pt-6 animate-in slide-in-from-top-4 duration-500">
              <div className="bg-blue-600 dark:bg-blue-700 rounded-[28px] p-6 shadow-xl shadow-blue-500/20 relative overflow-hidden group">
                <div className="flex items-start gap-5 relative z-10">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-white shrink-0">
                    <i className="fas fa-envelope-circle-check text-xl"></i>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-black text-white uppercase tracking-tight mb-1">Boîte mail non connectée</h3>
                    <p className="text-[11px] text-white/80 font-bold leading-relaxed mb-4">
                      Synchronisez vos comptes Gmail ou Outlook pour détecter automatiquement vos prochains colis.
                    </p>
                    <button onClick={() => setActiveTab('email_sync')} className="bg-white text-blue-600 px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 shadow-lg">
                      Connecter ma boîte
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'add' ? (
            <AddShipmentPage onBack={() => setActiveTab('incoming')} onSubmit={async (data) => { 
              // Create shipment via API instead of using mock
              try {
                await api.createParcel(data);
                // Reload shipments
                loadShipments();
                setActiveTab('incoming');
              } catch (error) {
                console.error('Failed to create shipment:', error);
              }
            }} />
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
                signOut();
              }}
            />
          ) : activeTab === 'email_sync' ? (
            <EmailSyncPage 
              status={syncStatus}
              summary={emailSummary}
              preferences={preferences}
              onUpdatePreferences={setPreferences}
              onSyncAction={handleSyncAction}
              onBack={() => setActiveTab('settings')}
            />
          ) : (
            <div className="px-5 py-6">
              {isLoadingShipments ? (
                // Show loading skeleton cards
                <>
                  <LoadingCard />
                  <LoadingCard />
                  <LoadingCard />
                  <LoadingCard />
                </>
              ) : filteredShipments.length === 0 ? (
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
