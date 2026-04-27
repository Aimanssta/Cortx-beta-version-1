import React, { useState, useEffect } from 'react';
import { 
  db, auth, googleProvider 
} from './lib/firebase';
import { 
  signInWithPopup, onAuthStateChanged, signOut, User, GoogleAuthProvider 
} from 'firebase/auth';
import { 
  collection, query, where, onSnapshot, doc, getDocFromServer,
  addDoc, updateDoc, deleteDoc, serverTimestamp, setDoc
} from 'firebase/firestore';
import { 
  LayoutDashboard, Store, MessageSquare, BarChart3, LogOut, 
  Plus, Edit2, Trash2, Send, Save, X, Check, Star, 
  MapPin, Phone, Globe, Clock, ChevronRight, AlertCircle, Sparkles,
  ShieldCheck, Calendar, Zap, Share2, FileSearch, FileText,
  Mic, Facebook, Instagram, Twitter, Image as ImageIcon,
  Megaphone, ShoppingBag, Briefcase, BookOpen, HelpCircle,
  Bell, Search, MoreHorizontal, RefreshCw, Target, Users
} from 'lucide-react';
import { GoogleBusinessService } from './services/googleBusiness';
import { GoogleAnalyticsService, AnalyticsMetrics, DayMetric } from './services/googleAnalytics';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from './lib/errorHandler';
import { generateReviewResponse, generateMarketingStrategy } from './services/gemini';
import { LegalLayout, PrivacyPolicyContent, TermsOfServiceContent } from './Legal';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';

// --- Types ---
interface BusinessProfile {
  id: string;
  name: string;
  address: string;
  phoneNumber: string;
  website: string;
  category: string;
  hours: string;
  description: string;
  ownerId: string;
}

interface Review {
  id: string;
  profileId: string;
  reviewerName: string;
  rating: number;
  comment: string;
  response: string;
  createdAt: any;
  respondedAt?: any;
}

interface Analytics {
  profileId: string;
  date: string;
  views: number;
  searches: number;
  actions: number;
}

interface GBPPost {
  id: string;
  profileId: string;
  content: string;
  imageUrl?: string;
  scheduledTime: any;
  status: 'draft' | 'scheduled' | 'published';
  createdAt: any;
  ownerId: string;
}

// --- Components ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'profile-audit' | 'post-scheduler' | 'strategy' | 'social' | 'website' | 'locations' | 'content' | 'performance' | 'reviews'
  >('dashboard');
  const [profiles, setProfiles] = useState<BusinessProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<{ metrics: AnalyticsMetrics, chartData: DayMetric[] } | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [posts, setPosts] = useState<GBPPost[]>([]);
  const [viewMode, setViewMode] = useState<'main' | 'privacy' | 'terms'>('main');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const page = params.get('page');
    if (page === 'privacy') setViewMode('privacy');
    else if (page === 'terms') setViewMode('terms');
  }, []);

  const [loginLoading, setLoginLoading] = useState(false);

  const handleLogin = async () => {
    setLoginLoading(true);
    try {
      googleProvider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        GoogleBusinessService.setToken(credential.accessToken);
      }
    } catch (error: any) {
      console.error("Login failed:", error);
      const errorCode = error?.code || error?.message || "";
      
      if (errorCode.includes('auth/popup-blocked')) {
        alert("Login popup was blocked by your browser. Please allow popups for this site and try again.");
      } else if (errorCode.includes('auth/popup-closed-by-user') || errorCode.includes('auth/cancelled-popup-request')) {
        // User closed the popup or cancelled, no need to alert
      } else if (errorCode.includes('auth/unauthorized-domain')) {
        alert("Domain not authorized. Please add your current domain (e.g., cortxai.us) to the 'Authorized domains' list in your Firebase Authentication settings.");
      } else {
        alert("Login failed: " + (error?.message || "Unknown error"));
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setProfiles([]);
      setSelectedProfile(null);
      setAnalyticsData(null);
      GoogleBusinessService.setToken(null);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const syncProfiles = async () => {
    if (!user) return;
    setSyncing(true);
    try {
      const gLocations = await GoogleBusinessService.fetchAllUserLocations();
      
      for (const loc of gLocations) {
        // Check if profile already exists in our Firestore
        const exists = profiles.find(p => p.id === loc.name.split('/').pop() || (p as any).googleLocationId === loc.name);
        if (!exists) {
          await addDoc(collection(db, 'profiles'), {
            name: loc.title,
            address: loc.title, // Simplified for demo
            phoneNumber: loc.storeCode || '',
            website: loc.websiteUri || '',
            category: loc.labels?.[0] || 'Business',
            description: '',
            ownerId: user.uid,
            googleLocationId: loc.name
          });
        }
      }
      alert(`Successfully synced ${gLocations.length} profiles from Google!`);
    } catch (error) {
      console.error("Sync failed:", error);
      if (error instanceof Error && error.message.includes('authentication scopes')) {
        alert("Authentication scopes missing. Please sign out and sign in again to grant permissions.");
      } else {
        alert("Failed to sync profiles. Make sure you granted the necessary permissions.");
      }
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'website' && selectedProfile && !analyticsData) {
      loadAnalytics();
    }
  }, [activeTab, selectedProfile]);

  const loadAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const properties = await GoogleAnalyticsService.fetchProperties();
      if (properties.length > 0) {
        const propId = properties[0].propertyId || properties[0].name.split('/').pop();
        const data = await GoogleAnalyticsService.getReport(propId);
        setAnalyticsData(data);
      } else {
        setAnalyticsData(GoogleAnalyticsService.getMockData());
      }
    } catch (error) {
      console.error("Failed to load analytics:", error);
      setAnalyticsData(GoogleAnalyticsService.getMockData());
    } finally {
      setAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch profiles for the user
  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'profiles'), where('ownerId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const pData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BusinessProfile));
      setProfiles(pData);
      if (pData.length > 0 && !selectedProfile) {
        setSelectedProfile(pData[0]);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'profiles');
    });

    return () => unsubscribe();
  }, [user]);

  // Fetch posts
  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'posts'), where('ownerId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GBPPost));
      setPosts(postData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'posts');
    });

    return () => unsubscribe();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (viewMode === 'privacy') {
    return <LegalLayout title="Privacy Policy" content={<PrivacyPolicyContent />} onBack={() => setViewMode('main')} />;
  }

  if (viewMode === 'terms') {
    return <LegalLayout title="Terms of Service" content={<TermsOfServiceContent />} onBack={() => setViewMode('main')} />;
  }

  if (!user) {
    return <LandingPage onLogin={handleLogin} isLoading={loginLoading} onNavigate={setViewMode} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row">
      {/* Sidebar */}
      <nav className="w-full md:w-64 bg-[#0a0a0c] border-r border-slate-800 p-4 flex flex-col gap-6 md:h-screen sticky top-0 z-50">
        <div className="flex items-center gap-3 px-2 mb-2">
          <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <span className="font-extrabold text-white text-xl">C</span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">CORTX GBP</h1>
        </div>

        <div className="flex-1 flex flex-col gap-1 overflow-y-auto custom-scrollbar">
          <div className="mb-2">
            <SidebarLink 
              icon={<ShieldCheck />} 
              label="Profile Audit" 
              active={activeTab === 'profile-audit'} 
              onClick={() => setActiveTab('profile-audit')} 
              indicator
            />
          </div>

          <div className="space-y-1">
            <SidebarLink 
              icon={<LayoutDashboard />} 
              label="GBP Dashboard" 
              active={activeTab === 'dashboard'} 
              onClick={() => setActiveTab('dashboard')} 
            />
            <SidebarLink 
              icon={<Calendar />} 
              label="Post Scheduler" 
              active={activeTab === 'post-scheduler'} 
              onClick={() => setActiveTab('post-scheduler')} 
            />
            <SidebarLink 
              icon={<Zap />} 
              label="Advanced Strategy" 
              active={activeTab === 'strategy'} 
              onClick={() => setActiveTab('strategy')} 
            />
            <SidebarLink 
              icon={<Share2 />} 
              label="Social Media" 
              active={activeTab === 'social'} 
              onClick={() => setActiveTab('social')} 
            />
            <SidebarLink 
              icon={<FileSearch />} 
              label="Website Analysis" 
              active={activeTab === 'website'} 
              onClick={() => setActiveTab('website')} 
            />
          </div>

          <div className="my-4 border-t border-slate-800" />

          <div className="space-y-1">
            <SidebarLink 
              icon={<MapPin />} 
              label="Locations" 
              active={activeTab === 'locations'} 
              onClick={() => setActiveTab('locations')} 
            />
            <SidebarLink 
              icon={<FileText />} 
              label="Content & Posts" 
              active={activeTab === 'content'} 
              onClick={() => setActiveTab('content')} 
            />
            <SidebarLink 
              icon={<BarChart3 />} 
              label="Performance" 
              active={activeTab === 'performance'} 
              onClick={() => setActiveTab('performance')} 
            />
          </div>
        </div>

        <div className="mt-auto pt-4 border-t border-slate-800">
          <div className="flex items-center gap-3 px-2 mb-4">
            <div className="relative">
              <img src={user.photoURL || ''} alt="" className="w-10 h-10 rounded-full border-2 border-slate-700 p-0.5" />
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-[#0a0a0c] rounded-full"></div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">{user.displayName}</p>
              <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors group"
          >
            <LogOut className="w-5 h-5 group-hover:text-red-400" />
            <span className="text-sm font-medium">Log out</span>
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Header */}
        <header className="h-20 bg-[#0a0a0c] border-b border-slate-800 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-6">
            <div className="relative group">
              <button className="flex items-center gap-3 bg-slate-900 hover:bg-slate-800 px-4 py-2 rounded-lg border border-slate-800 transition-all font-bold min-w-[220px]">
                <div className="w-6 h-6 rounded bg-indigo-600 flex items-center justify-center text-[10px] shrink-0">BR</div>
                <span className="truncate">{selectedProfile?.name || 'Select Business'}</span>
                <ChevronRight className="w-4 h-4 ml-auto rotate-90 text-slate-500" />
              </button>
            </div>
            
            <button 
              onClick={syncProfiles}
              disabled={syncing}
              className="flex items-center gap-2 px-3 py-2 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 rounded-lg border border-indigo-500/20 transition-all text-xs font-bold disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Profiles'}
            </button>
          </div>

          <div className="flex items-center gap-6">
            <button className="relative p-2 text-slate-400 hover:text-white transition-colors">
              <Bell className="w-6 h-6" />
              <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-[#0a0a0c]"></div>
            </button>
            
            <div className="flex items-center gap-3 border-l border-slate-800 pl-6 h-10">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-white">{user.displayName}</p>
                <p className="text-xs text-slate-500">{user.email?.split('@')[0]}@cortx.ai</p>
              </div>
              <img src={user.photoURL || ''} alt="" className="w-10 h-10 rounded-full object-cover border border-slate-700" />
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 md:p-10 bg-[#0c0c0e] overflow-y-auto custom-scrollbar relative">
          <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-10"
            >
              {/* Actions Grid */}
              <div className="bg-[#111114] border border-slate-800 rounded-3xl p-10">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-lg font-bold text-slate-200 uppercase tracking-widest">Your Business on Google</h3>
                  <div className="flex items-center gap-2 text-emerald-500 text-xs font-medium">
                    <Check className="w-4 h-4" />
                    <span>Synced 2 hours ago</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <DashboardAction icon={<Store />} label="Edit profile" onClick={() => setActiveTab('locations')} />
                  <DashboardAction icon={<Star />} label="Read reviews" onClick={() => setActiveTab('reviews')} active />
                  <DashboardAction icon={<MessageSquare />} label="Messages" />
                  <DashboardAction icon={<ImageIcon />} label="Photos" />
                  <DashboardAction icon={<BarChart3 />} label="Performance" onClick={() => setActiveTab('performance')} />
                  <DashboardAction icon={<Megaphone />} label="Advertise" />
                  <DashboardAction icon={<ShoppingBag />} label="Edit products" />
                  <DashboardAction icon={<Briefcase />} label="Edit services" />
                  <DashboardAction icon={<Calendar />} label="Bookings" />
                  <DashboardAction icon={<HelpCircle />} label="Q & A" />
                </div>
              </div>

              {/* Stats and Online Presence */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-[#111114] border border-slate-800 rounded-3xl p-8 relative overflow-hidden">
                  <div className="flex items-center justify-between mb-10">
                    <div>
                      <h3 className="text-2xl font-bold text-white mb-2">Performance</h3>
                      <p className="text-slate-500 text-sm">Interactions with your profile</p>
                    </div>
                    <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold text-indigo-400 transition-colors">
                      View Report
                    </button>
                  </div>

                  <div className="flex items-end gap-20">
                    <div>
                      <h4 className="text-4xl font-extrabold text-white mb-1">1.2k</h4>
                      <p className="text-slate-500 text-xs uppercase tracking-wider font-bold">Profile views</p>
                    </div>
                    <div>
                      <h4 className="text-4xl font-extrabold text-white mb-1">84</h4>
                      <p className="text-slate-500 text-xs uppercase tracking-wider font-bold">Calls</p>
                    </div>
                    <div>
                      <h4 className="text-4xl font-extrabold text-white mb-1">156</h4>
                      <p className="text-slate-500 text-xs uppercase tracking-wider font-bold">Website clicks</p>
                    </div>
                    
                    <div className="flex-1 h-32 relative">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={[
                          {v: 30}, {v: 45}, {v: 25}, {v: 60}, {v: 40}, {v: 80}, {v: 65}
                        ]}>
                          <defs>
                            <linearGradient id="tinyChart" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <Area type="monotone" dataKey="v" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#tinyChart)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                <div className="bg-[#111114] border border-slate-800 rounded-3xl p-8">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xl font-bold text-white">Online Presence</h3>
                    <span className="px-3 py-1 bg-emerald-500/10 text-emerald-500 text-[10px] font-bold rounded-full uppercase tracking-widest border border-emerald-500/20">Active</span>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center gap-4 bg-slate-900/50 p-4 rounded-2xl border border-slate-800/50 group hover:border-indigo-500/30 transition-all cursor-pointer">
                      <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-indigo-400 transition-colors">
                        <Globe className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-white">Website</p>
                        <p className="text-xs text-slate-500">borgesroofing.com</p>
                      </div>
                      <div className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <PresenceItem icon={<Facebook className="w-5 h-5" />} color="text-indigo-400" />
                      <PresenceItem icon={<Instagram className="w-5 h-5" />} color="text-pink-400" />
                      <PresenceItem icon={<Twitter className="w-5 h-5" />} color="text-sky-400" />
                      <PresenceItem icon={<Share2 className="w-5 h-5" />} color="text-slate-400" />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'reviews' && (
            <motion.div
              key="reviews"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {selectedProfile ? (
                <ReviewManagement profile={selectedProfile} />
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <AlertCircle className="w-16 h-16 text-slate-700 mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Access Denied</h3>
                  <p className="text-slate-400">Please select or create a business profile first.</p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'post-scheduler' && (
            <motion.div
              key="post-scheduler"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {selectedProfile ? (
                 <PostScheduler profile={selectedProfile} posts={posts} profiles={profiles} />
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <AlertCircle className="w-16 h-16 text-slate-700 mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Access Denied</h3>
                  <p className="text-slate-400">Please select or create a business profile first.</p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'strategy' && (
            <motion.div
              key="strategy"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {selectedProfile ? (
                 <AdvancedStrategy profile={selectedProfile} />
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <AlertCircle className="w-16 h-16 text-slate-700 mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Access Denied</h3>
                  <p className="text-slate-400">Please select or create a business profile first.</p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'website' && (
            <motion.div
              key="website"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold mb-2">Website Analysis</h2>
                  <p className="text-slate-400">Google Analytics insights for {selectedProfile?.name}</p>
                </div>
                <button 
                  onClick={loadAnalytics}
                  className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
                  title="Refresh Data"
                >
                  <RefreshCw className={`w-5 h-5 ${analyticsLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {analyticsData ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard 
                      label="Total Sessions" 
                      value={analyticsData.metrics.sessions.toLocaleString()} 
                      trend="+15.2%" 
                      icon={<Globe className="w-5 h-5" />} 
                    />
                    <StatCard 
                      label="Bounce Rate" 
                      value={`${analyticsData.metrics.bounceRate.toFixed(1)}%`} 
                      trend="-2.4%" 
                      icon={<Zap className="w-5 h-5" />} 
                    />
                    <StatCard 
                      label="Conversions" 
                      value={analyticsData.metrics.conversions.toString()} 
                      trend="+5.3%" 
                      icon={<Target className="w-5 h-5" />} 
                    />
                    <StatCard 
                      label="Users" 
                      value={analyticsData.metrics.users.toLocaleString()} 
                      trend="+12.1%" 
                      icon={<Users className="w-5 h-5" />} 
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-8">
                    <div className="bg-[#111114] border border-slate-800 rounded-3xl p-8">
                      <div className="flex items-center justify-between mb-8">
                        <div>
                          <h3 className="text-xl font-bold text-white mb-2">Traffic Overview</h3>
                          <p className="text-slate-500 text-sm">Sessions over the last 30 days</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-indigo-500 rounded-full"></div>
                            <span className="text-xs text-slate-400">Sessions</span>
                          </div>
                        </div>
                      </div>
                      <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={analyticsData.chartData}>
                            <defs>
                              <linearGradient id="colorSessions" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <XAxis 
                              dataKey="date" 
                              stroke="#64748b" 
                              fontSize={10} 
                              tickLine={false} 
                              axisLine={false}
                              tickFormatter={(val) => val.split('-').slice(1).join('/')}
                            />
                            <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                              itemStyle={{ color: '#fff' }}
                            />
                            <Area 
                              type="monotone" 
                              dataKey="sessions" 
                              stroke="#6366f1" 
                              strokeWidth={3}
                              fillOpacity={1} 
                              fill="url(#colorSessions)" 
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <div className="bg-[#111114] border border-slate-800 rounded-3xl p-8">
                        <h3 className="text-lg font-bold text-white mb-6">Conversion Goals</h3>
                        <div className="space-y-6">
                          <GoalItem label="Form Submissions" count={12} target={20} color="bg-indigo-500" />
                          <GoalItem label="Phone Calls" count={45} target={50} color="bg-emerald-500" />
                          <GoalItem label="Email Clicks" count={28} target={30} color="bg-sky-500" />
                        </div>
                      </div>
                      <div className="bg-[#111114] border border-slate-800 rounded-3xl p-8">
                        <h3 className="text-lg font-bold text-white mb-6">Device Breakdown</h3>
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <span className="text-slate-400">Mobile</span>
                            <span className="text-white font-bold">68%</span>
                          </div>
                          <div className="w-full bg-slate-800 h-2 rounded-full">
                            <div className="bg-indigo-500 h-full rounded-full" style={{ width: '68%' }}></div>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-400">Desktop</span>
                            <span className="text-white font-bold">28%</span>
                          </div>
                          <div className="w-full bg-slate-800 h-2 rounded-full">
                            <div className="bg-emerald-500 h-full rounded-full" style={{ width: '28%' }}></div>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-400">Tablet</span>
                            <span className="text-white font-bold">4%</span>
                          </div>
                          <div className="w-full bg-slate-800 h-2 rounded-full">
                            <div className="bg-orange-500 h-full rounded-full" style={{ width: '4%' }}></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center min-h-[400px] bg-[#111114] border border-slate-800 rounded-3xl p-10">
                  <Globe className="w-16 h-16 text-slate-700 mb-4 animate-pulse" />
                  <h3 className="text-xl font-bold mb-2">Connecting to Google Analytics...</h3>
                  <p className="text-slate-500 max-w-sm text-center">We're fetching the latest session and conversion data for your business website.</p>
                </div>
              )}
            </motion.div>
          )}
          {['profile-audit', 'social', 'locations', 'content', 'performance'].includes(activeTab) && (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center justify-center min-h-[60vh] text-center"
            >
              <div className="w-24 h-24 bg-indigo-500/10 rounded-3xl flex items-center justify-center mb-6 border border-indigo-500/20 animate-pulse">
                {activeTab === 'profile-audit' && <ShieldCheck className="w-12 h-12 text-indigo-400" />}
                {activeTab === 'post-scheduler' && <Calendar className="w-12 h-12 text-indigo-400" />}
                {activeTab === 'strategy' && <Zap className="w-12 h-12 text-indigo-400" />}
                {activeTab === 'social' && <Share2 className="w-12 h-12 text-indigo-400" />}
                {activeTab === 'locations' && <MapPin className="w-12 h-12 text-indigo-400" />}
                {activeTab === 'content' && <FileText className="w-12 h-12 text-indigo-400" />}
                {activeTab === 'performance' && <BarChart3 className="w-12 h-12 text-indigo-400" />}
              </div>
              <h2 className="text-3xl font-bold text-white mb-4 capitalize">{String(activeTab).replace('-', ' ')}</h2>
              <p className="text-slate-500 max-w-md">This advanced AI-powered module is currently being optimized for your business profile. Check back shortly for deep insights.</p>
            </motion.div>
          )}
          </AnimatePresence>

          {/* Voice Chat Floating Button */}
          <button className="fixed bottom-10 right-10 flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-full font-black uppercase tracking-widest shadow-[0_10px_40px_rgba(79,70,229,0.4)] transition-all transform hover:scale-105 active:scale-95 z-50">
            <Mic className="w-6 h-6" />
            <span>Voice Chat</span>
          </button>
        </main>
      </div>
    </div>
  );
}

// --- Sub-components ---

function LandingPage({ onLogin, isLoading, onNavigate }: { onLogin: () => void, isLoading: boolean, onNavigate: (mode: 'privacy' | 'terms') => void }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 relative overflow-hidden text-center">
      {/* Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full bg-grid-slate-900 bg-grid-mask z-0" />
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/20 blur-[120px] rounded-full z-0" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/20 blur-[120px] rounded-full z-0" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-4xl z-10"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-900 border border-slate-800 rounded-full mb-8">
          <span className="flex h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
          <span className="text-xs font-medium text-slate-300">Beta Version 1.0</span>
        </div>
        
        <h1 className="text-5xl md:text-7xl font-extrabold mb-8 tracking-tight text-white leading-tight">
          CORTX <br />
          <span className="gradient-text">GBP AI</span>
        </h1>
        
        <p className="text-lg md:text-xl text-slate-400 mb-12 max-w-2xl mx-auto leading-relaxed">
          CORTX GBP helps you manage your Google Business Profile with Gemini AI. 
          Respond to reviews, track analytics, and optimize your local presence efficiently.
          <br /><br />
          <span className="text-sm opacity-60">We use your Google data solely for dashboard analytics and AI-powered review responses. Your data is encrypted and never shared.</span>
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button 
            onClick={onLogin}
            disabled={isLoading}
            className="w-full sm:w-auto px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-3 disabled:opacity-70"
          >
            {isLoading ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <Globe className="w-5 h-5" />
            )}
            {isLoading ? 'Connecting...' : 'Get Started with Google'}
          </button>
        </div>

        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          <FeatureCard 
            title="AI Reviews" 
            desc="Generate professional responses with Gemini 1.5 Flash." 
            icon={<Sparkles className="text-indigo-400" />}
          />
          <FeatureCard 
            title="Deep Analytics" 
            desc="Track views, searches, and actions across all profiles." 
            icon={<BarChart3 className="text-indigo-400" />}
          />
          <FeatureCard 
            title="Multi-Profile" 
            desc="Manage all your business locations from a single dashboard." 
            icon={<Store className="text-indigo-400" />}
          />
        </div>
      </motion.div>

      {/* Footer with Legal Links */}
      <footer className="absolute bottom-8 left-0 w-full z-10 px-8 text-center sm:text-left">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-600">
          <p>© 2024 CORTX GBP. All rights reserved.</p>
          <div className="flex gap-6">
            <button 
              onClick={() => onNavigate('privacy')}
              className="hover:text-slate-300 transition-colors cursor-pointer"
            >
              Privacy Policy
            </button>
            <button 
              onClick={() => onNavigate('terms')}
              className="hover:text-slate-300 transition-colors cursor-pointer"
            >
              Terms of Service
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

function SidebarLink({ icon, label, active, onClick, indicator }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void, indicator?: boolean }) {
  return (
    <button 
      onClick={onClick}
      className={`relative w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-300 group ${
        active 
          ? 'bg-indigo-600/10 text-white border border-indigo-500/20 shadow-[0_0_20px_rgba(79,70,229,0.1)]' 
          : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800/30'
      }`}
    >
      <span className={`w-5 h-5 transition-transform duration-300 ${active ? 'text-indigo-400 scale-110' : 'group-hover:text-slate-300 group-hover:scale-110'}`}>
        {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { className: 'w-full h-full stroke-[2.5]' }) : icon}
      </span>
      <span className={`text-[13px] font-bold tracking-tight transition-colors duration-300 ${active ? 'text-white' : ''}`}>{label}</span>
      
      {indicator && active && (
        <div className="absolute right-3 w-1.5 h-6 bg-indigo-500 rounded-full shadow-[0_0_10px_rgba(79,70,229,0.6)] animate-pulse"></div>
      )}
    </button>
  );
}

function DashboardAction({ icon, label, onClick, active }: { icon: React.ReactNode, label: string, onClick?: () => void, active?: boolean }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-4 p-6 bg-[#0a0a0c] border border-slate-800 rounded-2xl transition-all hover:border-slate-700 hover:bg-slate-800/20 group relative overflow-hidden ${active ? 'ring-2 ring-indigo-500/20' : ''}`}
    >
      <div className={`p-2 transition-colors duration-300 ${active ? 'text-indigo-400' : 'text-slate-500 group-hover:text-indigo-400'}`}>
        {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { className: 'w-6 h-6' }) : icon}
      </div>
      <span className="text-[11px] font-black uppercase tracking-widest text-slate-400 group-hover:text-white transition-colors">{label}</span>
    </button>
  );
}

function PresenceItem({ icon, color }: { icon: React.ReactNode, color: string }) {
  return (
    <div className={`flex items-center justify-center p-4 bg-slate-900 border border-slate-800 rounded-2xl hover:border-slate-700 transition-colors cursor-pointer group`}>
      <div className={`${color} opacity-60 group-hover:opacity-100 transition-opacity`}>
        {icon}
      </div>
    </div>
  );
}

function GoalItem({ label, count, target, color }: { label: string, count: number, target: number, color: string }) {
  const percentage = Math.min(Math.round((count / target) * 100), 100);
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center text-sm">
        <span className="text-slate-400 font-medium">{label}</span>
        <span className="text-white font-bold">{count} / {target}</span>
      </div>
      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
        <div className={`${color} h-full rounded-full transition-all duration-500`} style={{ width: `${percentage}%` }}></div>
      </div>
    </div>
  );
}

function FeatureCard({ title, desc, icon }: { title: string, desc: string, icon: React.ReactNode }) {
  return (
    <div className="glass-card p-6 flex flex-col gap-3">
      <div className="p-2 bg-slate-800/50 rounded-lg w-fit">{icon}</div>
      <h3 className="font-bold text-white tracking-tight">{title}</h3>
      <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
    </div>
  );
}

function StatCard({ label, value, trend, icon }: { label: string, value: string, trend: string, icon: React.ReactNode }) {
  return (
    <div className="glass-card p-6 group hover:border-blue-500/30 transition-all">
      <div className="flex justify-between items-start mb-4">
        <div className="p-2 bg-slate-800/50 rounded-lg text-slate-400 group-hover:text-blue-400 transition-colors">
          {icon}
        </div>
        <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${trend.startsWith('+') ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
          {trend}
        </span>
      </div>
      <div>
        <h4 className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-1">{label}</h4>
        <p className="text-2xl font-bold">{value}</p>
      </div>
    </div>
  );
}

function PerformanceChart() {
  const data = [
    { name: 'Mon', views: 320, actions: 45 },
    { name: 'Tue', views: 450, actions: 52 },
    { name: 'Wed', views: 380, actions: 38 },
    { name: 'Thu', views: 620, actions: 85 },
    { name: 'Fri', views: 780, actions: 120 },
    { name: 'Sat', views: 540, actions: 64 },
    { name: 'Sun', views: 420, actions: 48 },
  ];

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs>
          <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
        <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
        <Tooltip 
          contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
          itemStyle={{ color: '#fff' }}
        />
        <Area type="monotone" dataKey="views" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colorViews)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function RecentReviews({ profileId }: { profileId: string }) {
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, 'profiles', profileId, 'reviews'),
      where('rating', '>', 0)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setReviews(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Review)).slice(0, 3));
    });
    return () => unsubscribe();
  }, [profileId]);

  return (
    <div className="space-y-4">
      {reviews.length > 0 ? reviews.map(review => (
          <div className="p-4 rounded-lg bg-slate-800/30 border border-slate-700/50 flex gap-4">
          <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold uppercase">{review.reviewerName[0]}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start mb-1">
              <h4 className="text-sm font-bold truncate">{review.reviewerName}</h4>
              <div className="flex text-yellow-500">
                <span className="text-xs tracking-tighter">
                  {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-300 italic line-clamp-2 leading-relaxed">"{review.comment}"</p>
          </div>
        </div>
      )) : (
        <p className="text-center text-slate-500 py-8 italic">No recent reviews to show.</p>
      )}
    </div>
  );
}

function ProfileManagement({ profiles, selectedProfile, setSelectedProfile, onProfileCreated }: any) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<BusinessProfile>>({
    name: '', address: '', phoneNumber: '', website: '', category: '', hours: '', description: ''
  });

  useEffect(() => {
    if (selectedProfile && !isEditing) {
      setFormData(selectedProfile);
    }
  }, [selectedProfile, isEditing]);

  async function handleSave() {
    if (!auth.currentUser) return;
    try {
      if (selectedProfile?.id) {
        // Update
        await updateDoc(doc(db, 'profiles', selectedProfile.id), {
          ...formData,
          updatedAt: serverTimestamp()
        });
      } else {
        // Create
        const newDoc = await addDoc(collection(db, 'profiles'), {
          ...formData,
          ownerId: auth.currentUser.uid,
          updatedAt: serverTimestamp()
        });
        // Add sample reviews for new profile
        await addDoc(collection(db, 'profiles', newDoc.id, 'reviews'), {
          profileId: newDoc.id,
          reviewerName: 'John Smith',
          rating: 5,
          comment: 'Outstanding service! This place never disappoints.',
          response: '',
          createdAt: serverTimestamp()
        });
      }
      setIsEditing(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'profiles');
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Business Profile</h2>
        <div className="flex gap-3">
          {profiles.length > 0 && !isEditing && (
            <button 
              onClick={() => { setIsEditing(true); setFormData({ name: '', address: '', phoneNumber: '', website: '', category: '', hours: '', description: '' }); setSelectedProfile(null); }}
              className="px-4 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-lg text-sm flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> New Profile
            </button>
          )}
          {selectedProfile && !isEditing && (
            <button 
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-primary hover:bg-primary-hover rounded-lg text-sm flex items-center gap-2"
            >
              <Edit2 className="w-4 h-4" /> Edit Profile
            </button>
          )}
        </div>
      </div>

      {(isEditing || !selectedProfile) ? (
        <div className="glass-card rounded-2xl p-8 max-w-3xl mx-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Business Name</label>
              <input 
                value={formData.name || ''} 
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-3 outline-none focus:border-primary transition-colors"
                placeholder="e.g. The Artisan Bakery"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Category</label>
              <input 
                value={formData.category || ''} 
                onChange={e => setFormData({...formData, category: e.target.value})}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-3 outline-none focus:border-primary transition-colors"
                placeholder="e.g. Bakery"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase">Address</label>
            <input 
              value={formData.address || ''} 
              onChange={e => setFormData({...formData, address: e.target.value})}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-3 outline-none focus:border-primary transition-colors"
              placeholder="123 Soho Street, London"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Phone Number</label>
              <input 
                value={formData.phoneNumber || ''} 
                onChange={e => setFormData({...formData, phoneNumber: e.target.value})}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-3 outline-none focus:border-primary transition-colors"
                placeholder="+44 20 1234 5678"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Website</label>
              <input 
                value={formData.website || ''} 
                onChange={e => setFormData({...formData, website: e.target.value})}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-3 outline-none focus:border-primary transition-colors"
                placeholder="https://artisanbakery.com"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase">Description</label>
            <textarea 
              value={formData.description || ''} 
              onChange={e => setFormData({...formData, description: e.target.value})}
              rows={4}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-3 outline-none focus:border-primary transition-colors resize-none"
              placeholder="Tell customers about your business..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button 
              onClick={() => setIsEditing(false)}
              className="px-6 py-2 rounded-xl text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              className="px-8 py-2 bg-primary hover:bg-primary-hover rounded-lg font-bold flex items-center gap-2"
            >
              <Save className="w-4 h-4" /> Save Profile
            </button>
          </div>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-6">
            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="h-32 bg-blue-600/20 relative">
                <div className="absolute -bottom-8 left-8 p-1 bg-slate-950 rounded-2xl">
                  <div className="w-20 h-20 bg-slate-900 rounded-xl flex items-center justify-center">
                    <Store className="w-10 h-10 text-primary" />
                  </div>
                </div>
              </div>
              <div className="p-8 pt-12 space-y-6">
                <div>
                  <h3 className="text-2xl font-bold mb-1">{selectedProfile.name}</h3>
                  <p className="text-blue-400 font-medium">{selectedProfile.category}</p>
                </div>
                <p className="text-slate-400 leading-relaxed italic">{selectedProfile.description || 'No description provided.'}</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <ProfileDetail icon={<MapPin />} label="Address" value={selectedProfile.address} />
                  <ProfileDetail icon={<Phone />} label="Phone" value={selectedProfile.phoneNumber} />
                  <ProfileDetail icon={<Globe />} label="Website" value={selectedProfile.website} />
                  <ProfileDetail icon={<Clock />} label="Hours" value={selectedProfile.hours || 'Mon-Sun: 9:00 AM - 6:00 PM'} />
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-6">
            <div className="glass-card rounded-2xl p-6">
              <h4 className="font-bold mb-4 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-orange-400" /> Profile Strength
              </h4>
              <div className="w-full bg-slate-800 h-2 rounded-full mb-2">
                <div className="bg-primary h-2 rounded-full w-[85%]" />
              </div>
              <p className="text-xs text-slate-500">Your profile is 85% complete. Add photos to reach 100%.</p>
            </div>
            <div className="glass-card rounded-2xl p-6 bg-blue-600/5 border-blue-500/20">
              <h4 className="font-bold mb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-400" /> AI Optimization
              </h4>
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                Our AI suggests updating your description to include "Freshly roasted coffee" for better SEO.
              </p>
              <button className="text-xs font-bold text-blue-400 hover:text-blue-300">Apply Suggestion</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileDetail({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="p-2 bg-slate-900 rounded-lg text-slate-500 mt-1">
        {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { className: 'w-4 h-4' }) : icon}
      </div>
      <div>
        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{label}</p>
        <p className="text-sm font-medium">{value || 'Not provided'}</p>
      </div>
    </div>
  );
}

function AdvancedStrategy({ profile }: { profile: BusinessProfile }) {
  const [strategy, setStrategy] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    const metrics = `Profile View: 1.2k, Conversions: 56, Rating: 4.8`;
    const result = await generateMarketingStrategy(profile.name, profile.category, metrics);
    setStrategy(result);
    setLoading(false);
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold mb-1">Advanced AI Strategy</h2>
          <p className="text-slate-400">Data-driven marketing pathways for <span className="text-indigo-400">{profile.name}</span></p>
        </div>
        <button 
          onClick={handleGenerate}
          disabled={loading}
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50"
        >
          {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
          {loading ? 'Analyzing...' : 'Generate New Strategy'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          {strategy ? (
             <motion.div 
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               className="bg-[#111114] border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden"
             >
               <div className="absolute top-0 right-0 p-4 opacity-5">
                 <Zap className="w-32 h-32 text-indigo-400" />
               </div>
               <div className="prose prose-invert max-w-none prose-p:text-slate-300 prose-headings:text-white prose-li:text-slate-400">
                 <div className="whitespace-pre-wrap font-sans text-lg leading-relaxed">
                   {strategy}
                 </div>
               </div>
               <div className="mt-8 pt-8 border-t border-slate-800 flex gap-4">
                 <button className="px-4 py-2 bg-slate-900 hover:bg-slate-800 rounded-lg text-xs font-bold flex items-center gap-2">
                   <Save className="w-4 h-4" /> Save Strategy
                 </button>
                 <button className="px-4 py-2 bg-slate-900 hover:bg-slate-800 rounded-lg text-xs font-bold flex items-center gap-2">
                   <Send className="w-4 h-4" /> Send to Team
                 </button>
               </div>
             </motion.div>
          ) : (
            <div className="bg-[#111114] border border-slate-800 border-dashed rounded-3xl p-20 text-center">
              <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-700">
                <Target className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold mb-2">No active strategy</h3>
              <p className="text-slate-500 max-w-sm mx-auto mb-8">
                Click generate to let Gemini 1.5 Flash analyze your profile metrics and local competitive landscape.
              </p>
              <button 
                onClick={handleGenerate}
                className="px-8 py-4 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 rounded-2xl font-bold border border-indigo-500/20 transition-all"
              >
                Start AI Analysis
              </button>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-gradient-to-br from-indigo-600/20 to-purple-600/20 border border-indigo-500/20 rounded-3xl p-8">
            <h4 className="font-bold text-white mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-indigo-400" /> Local Dominance
            </h4>
            <p className="text-sm text-slate-400 leading-relaxed mb-6">
              Our AI evaluates over 50 data points including competitor review velocity and local map pack rankings.
            </p>
            <div className="space-y-4">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-500">Market Share</span>
                <span className="text-indigo-400">12%</span>
              </div>
              <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                <div className="bg-indigo-600 h-full w-[12%]" />
              </div>
            </div>
          </div>

          <div className="bg-slate-900/30 border border-slate-800 rounded-3xl p-8">
            <h4 className="font-bold text-white mb-4">Past Strategies</h4>
            <div className="space-y-4 opacity-50">
              <p className="text-xs text-slate-500 italic">No history yet.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReviewManagement({ profile }: { profile: BusinessProfile }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'profiles', profile.id, 'reviews'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setReviews(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Review)));
    });
    return () => unsubscribe();
  }, [profile.id]);

  async function handleAIGenerate(review: Review) {
    setIsGenerating(true);
    const suggested = await generateReviewResponse(profile.name, review.reviewerName, review.rating, review.comment);
    setReplyText(suggested);
    setIsGenerating(false);
  }

  async function handleSendReply(reviewId: string) {
    try {
      await updateDoc(doc(db, 'profiles', profile.id, 'reviews', reviewId), {
        response: replyText,
        respondedAt: serverTimestamp()
      });
      setReplyingTo(null);
      setReplyText('');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `profiles/${profile.id}/reviews/${reviewId}`);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold mb-1">Customer Reviews</h2>
          <p className="text-slate-400">Managing feedback for <span className="font-bold text-blue-400">{profile.name}</span></p>
        </div>
        <div className="flex items-center gap-4 px-4 py-2 bg-slate-900 rounded-xl border border-slate-800">
          <div className="flex gap-0.5">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className={`w-4 h-4 ${i < 4 ? 'fill-yellow-400 text-yellow-400' : 'text-slate-700'}`} />
            ))}
          </div>
          <span className="text-sm font-bold">4.8 Overall</span>
        </div>
      </div>

      <div className="space-y-6">
        {reviews.length > 0 ? reviews.map(review => (
          <div key={review.id} className="glass-card rounded-2xl p-6 relative group overflow-hidden">
            {review.response && (
              <div className="absolute top-0 right-0 p-1">
                <div className="bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-bl-xl text-[10px] font-bold uppercase flex items-center gap-1">
                  <Check className="w-3 h-3" /> Responded
                </div>
              </div>
            )}
            
            <div className="flex gap-6">
              <div className="w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center text-primary font-bold border border-slate-800">
                {review.reviewerName[0]}
              </div>
              <div className="flex-1 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-lg">{review.reviewerName}</h4>
                    <div className="flex gap-1 mt-1">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className={`w-4 h-4 ${i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-slate-700'}`} />
                      ))}
                    </div>
                  </div>
                  <span className="text-xs text-slate-500">2 days ago</span>
                </div>
                
                <p className="text-slate-300 leading-relaxed italic border-l-2 border-slate-800 pl-4 py-1">
                  "{review.comment}"
                </p>

                {review.response ? (
                  <div className="bg-slate-950/50 p-4 rounded-xl border border-blue-500/10">
                    <div className="flex items-center gap-2 mb-2">
                       <Store className="w-3 h-3 text-blue-400" />
                       <span className="text-[10px] font-bold text-slate-500 uppercase">Your Response</span>
                    </div>
                    <p className="text-sm text-slate-400">{review.response}</p>
                  </div>
                ) : (
                  <div className="pt-2">
                    {replyingTo === review.id ? (
                      <div className="space-y-3 p-4 bg-slate-900/50 rounded-xl">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-500 uppercase">Draft Reply</span>
                          <button 
                            onClick={() => handleAIGenerate(review)}
                            disabled={isGenerating}
                            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-bold disabled:opacity-50"
                          >
                            <Sparkles className="w-3 h-3" /> {isGenerating ? 'Generating...' : 'Regenerate with AI'}
                          </button>
                        </div>
                        <textarea 
                          value={replyText}
                          onChange={e => setReplyText(e.target.value)}
                          rows={3}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary resize-none"
                          placeholder="Type your response or use AI..."
                        />
                        <div className="flex justify-end gap-2">
                          <button onClick={() => { setReplyingTo(null); setReplyText(''); }} className="text-xs px-3 py-1 text-slate-500">Cancel</button>
                          <button 
                            onClick={() => handleSendReply(review.id)}
                            className="text-xs px-4 py-1.5 bg-primary hover:bg-primary-hover rounded-lg font-bold flex items-center gap-1"
                          >
                            <Send className="w-3 h-3" /> Send Response
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button 
                         onClick={() => { setReplyingTo(review.id); setReplyText(''); }}
                         className="px-4 py-2 bg-slate-900 hover:bg-slate-800 rounded-lg text-xs font-bold flex items-center gap-2 transition-all"
                      >
                         <MessageSquare className="w-3 h-3" /> Reply with AI
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )) : (
          <div className="text-center py-20 bg-slate-900/20 rounded-3xl border border-slate-800 border-dashed">
            <MessageSquare className="w-12 h-12 text-slate-700 mx-auto mb-4" />
            <p className="text-slate-500">No reviews found for this profile.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function PostScheduler({ profile, posts, profiles }: { profile: BusinessProfile, posts: GBPPost[], profiles: BusinessProfile[] }) {
  const [isCreating, setIsCreating] = useState(false);
  const [content, setContent] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [targetProfiles, setTargetProfiles] = useState<string[]>([profile.id]);
  const [submitting, setSubmitting] = useState(false);

  const profilePosts = posts.filter(p => p.profileId === profile.id);

  async function handleSchedule() {
    if (!content || !scheduledDate || !scheduledTime || !auth.currentUser) return;
    setSubmitting(true);
    try {
      const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`);
      
      for (const pId of targetProfiles) {
        await addDoc(collection(db, 'posts'), {
          profileId: pId,
          content,
          scheduledTime: scheduledAt.toISOString(),
          status: 'scheduled',
          createdAt: serverTimestamp(),
          ownerId: auth.currentUser.uid
        });
      }
      
      setIsCreating(false);
      setContent('');
      setScheduledDate('');
      setScheduledTime('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'posts');
    } finally {
      setSubmitting(false);
    }
  }

  const toggleProfile = (id: string) => {
    setTargetProfiles(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold mb-1">Post Scheduler</h2>
          <p className="text-slate-400">Schedule content across your Google Business Profiles</p>
        </div>
        {!isCreating && (
          <button 
            onClick={() => setIsCreating(true)}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-500/20 transition-all transform hover:scale-105"
          >
            <Plus className="w-5 h-5" /> Schedule New Post
          </button>
        )}
      </div>

      <AnimatePresence>
        {isCreating && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-[#111114] border border-slate-800 rounded-3xl p-8 mb-8">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold">New Scheduled Post</h3>
                <button onClick={() => setIsCreating(false)} className="p-2 hover:bg-slate-800 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Post Content</label>
                    <textarea 
                      value={content}
                      onChange={e => setContent(e.target.value)}
                      rows={6}
                      className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-4 py-4 outline-none focus:border-indigo-500 transition-colors resize-none"
                      placeholder="What's new with your business? Include updates, offers, or events..."
                    />
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>Google Business Profile limit: 1500 characters</span>
                      <span>{content.length}/1500</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase">Date</label>
                      <input 
                        type="date"
                        value={scheduledDate}
                        onChange={e => setScheduledDate(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase">Time</label>
                      <input 
                        type="time"
                        value={scheduledTime}
                        onChange={e => setScheduledTime(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 transition-colors"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-4">
                    <label className="text-xs font-bold text-slate-500 uppercase">Target Profiles</label>
                    <div className="space-y-2 max-h-[220px] overflow-y-auto custom-scrollbar pr-2">
                      {profiles.map(p => (
                        <button 
                          key={p.id}
                          onClick={() => toggleProfile(p.id)}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                            targetProfiles.includes(p.id) 
                              ? 'bg-indigo-600/10 border-indigo-500 text-white' 
                              : 'bg-slate-900/50 border-slate-800 text-slate-500 hover:border-slate-700'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${targetProfiles.includes(p.id) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-700'}`}>
                            {targetProfiles.includes(p.id) && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <span className="text-sm font-bold truncate">{p.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-800 border-dashed">
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Posts scheduled with Cort X AI are automatically synchronized with Google Business Profiles at the exact time specified.
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <button 
                       disabled={submitting}
                       className="flex-1 px-6 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold flex items-center justify-center gap-3 shadow-lg shadow-indigo-500/20 disabled:opacity-50 transition-all"
                       onClick={handleSchedule}
                    >
                      {submitting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Calendar className="w-5 h-5" />}
                      {submitting ? 'Scheduling...' : 'Schedule Post'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-400" /> Upcoming Posts
          </h3>
          
          <div className="space-y-4">
            {profilePosts.length > 0 ? profilePosts
              .filter(p => p.status === 'scheduled')
              .sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime())
              .map(post => (
                <div key={post.id} className="bg-[#111114] border border-slate-800 rounded-2xl p-6 group hover:border-indigo-500/30 transition-all">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 bg-slate-900 rounded-xl flex flex-col items-center justify-center border border-slate-800">
                      <span className="text-[10px] font-bold text-indigo-400 uppercase">{new Date(post.scheduledTime).toLocaleString('default', { month: 'short' })}</span>
                      <span className="text-lg font-bold leading-none">{new Date(post.scheduledTime).getDate()}</span>
                    </div>
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500">{new Date(post.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        <div className="flex gap-2">
                          <button className="p-1 px-2.5 bg-slate-900 hover:bg-slate-800 rounded text-[10px] font-bold text-slate-400 transition-colors">Edit</button>
                          <button className="p-1 px-2.5 bg-red-500/10 hover:bg-red-500/20 rounded text-[10px] font-bold text-red-400 transition-colors">Remove</button>
                        </div>
                      </div>
                      <p className="text-slate-300 text-sm leading-relaxed line-clamp-3">
                        {post.content}
                      </p>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="flex flex-col items-center justify-center p-12 bg-[#111114] border border-slate-800 border-dashed rounded-3xl text-center">
                  <div className="w-12 h-12 bg-slate-900 rounded-full flex items-center justify-center mb-4 text-slate-600">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-slate-300 mb-1">No scheduled posts</h4>
                  <p className="text-xs text-slate-500">Create your first post to see it in the list.</p>
                </div>
              )}
          </div>
        </div>

        <div className="space-y-6">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Check className="w-5 h-5 text-emerald-400" /> Published Recently
          </h3>
          <div className="space-y-4">
            {profilePosts
              .filter(p => p.status === 'published')
              .slice(0, 3)
              .map(post => (
                <div key={post.id} className="bg-slate-900/30 border border-slate-800/50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-2">{new Date(post.scheduledTime).toLocaleDateString()}</p>
                  <p className="text-xs text-slate-300 line-clamp-2 italic">"{post.content}"</p>
                </div>
              ))}
            
            <div className="bg-gradient-to-br from-indigo-600/20 to-purple-600/20 border border-indigo-500/20 rounded-2xl p-6">
              <h4 className="font-bold text-white mb-2 flex items-center gap-2 text-sm">
                <Sparkles className="w-4 h-4 text-indigo-400" /> AI Suggestions
              </h4>
              <p className="text-[11px] text-slate-400 leading-relaxed mb-4">
                Based on your business category, posts about "Community Impact" tend to get 35% more engagement on Wednesdays.
              </p>
              <button className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-widest">Generate Idea</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
