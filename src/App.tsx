/// <reference types="vite/client" />
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
import { 
  generateReviewResponse, generateMarketingStrategy, generatePostContent, generateQA, analyzeBusinessProfile 
} from './services/gemini';
import { LegalLayout, PrivacyPolicyContent, TermsOfServiceContent } from './Legal';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

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

import { SEODashboard } from './components/SEODashboard';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'profile-audit' | 'post-scheduler' | 'strategy' | 'social' | 'website' | 'locations' | 'content' | 'performance' | 'reviews' | 'seo-engine' | 'qa'
  >('dashboard');
  const [profiles, setProfiles] = useState<BusinessProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<{ metrics: AnalyticsMetrics, chartData: DayMetric[] } | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [posts, setPosts] = useState<GBPPost[]>([]);
  const [viewMode, setViewMode] = useState<'main' | 'privacy' | 'terms'>('main');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [auditStatus, setAuditStatus] = useState<'none' | 'running' | 'completed'>('none');
  const [auditResult, setAuditResult] = useState<any>(null);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const page = params.get('page');
    if (page === 'privacy') setViewMode('privacy');
    else if (page === 'terms') setViewMode('terms');

    const subscribed = params.get('subscribed');
    if (subscribed === 'true') {
      setIsSubscribed(true);
      alert("Welcome to CORTX Premium! Your subscription is active.");
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (subscribed === 'false') {
      alert("Subscription cancelled. You can upgrade anytime.");
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const [isUpgrading, setIsUpgrading] = useState(false);

  const handleUpgrade = async () => {
    setIsUpgrading(true);
    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const responseText = await response.text();
      let session;
      try {
        session = JSON.parse(responseText);
      } catch (e) {
        console.error("Server returned non-JSON response:", responseText);
        throw new Error(`The server returned an error page. This usually means the Stripe key is missing or the server is misconfigured. Response: ${responseText.substring(0, 100)}`);
      }

      if (session.url) {
        window.location.href = session.url;
      } else {
        throw new Error('Could not create checkout session');
      }
    } catch (error: any) {
      console.error('Upgrade error:', error);
      alert('Error creating checkout session: ' + error.message);
    } finally {
      setIsUpgrading(false);
    }
  };

  const [loginLoading, setLoginLoading] = useState(false);

  const handleLogin = async () => {
    setLoginLoading(true);
    try {
      googleProvider.setCustomParameters({ 
        prompt: 'consent', 
        access_type: 'offline'
      });
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
      console.log('Starting GBP Profile Sync...');
      const gLocations = await GoogleBusinessService.fetchAllUserLocations();
      console.log(`Fetched ${gLocations.length} locations from Google.`);
      
      if (gLocations.length === 0) {
        alert("No business profiles found in your Google account. Make sure you have claimed businesses in Google Business Profile.");
        return;
      }

      let newCount = 0;
      for (const loc of gLocations) {
        // Check if profile already exists in our Firestore
        // loc.name is "locations/{id}"
        const locationId = loc.name.split('/').pop();
        const exists = profiles.find(p => p.id === locationId || (p as any).googleLocationId === loc.name);
        
        if (!exists) {
          console.log(`Adding new location: ${loc.title}`);
          await addDoc(collection(db, 'profiles'), {
            name: loc.title,
            address: loc.title, 
            phoneNumber: loc.storeCode || '',
            website: loc.websiteUri || '',
            category: loc.labels?.[0] || 'Business',
            description: '',
            ownerId: user.uid,
            googleLocationId: loc.name
          });
          newCount++;
        }
      }
      
      if (newCount > 0) {
        alert(`Successfully synced ${gLocations.length} profiles! Added ${newCount} new ones.`);
      } else {
        alert(`Your profiles are already up to date. (${gLocations.length} locations found)`);
      }
    } catch (error: any) {
      console.error("Sync error detailed:", error);
      
      const errorMsg = error?.message || "";
      if (errorMsg.includes('authentication credentials') || errorMsg.includes('401')) {
        alert("Authentication Error: Your Google session may have expired or permissions were not granted.\n\nIMPORTANT: Please logout and login again. When signing in, YOU MUST CHECK THE BOXES to grant 'See, edit, create and delete your Google business listings' permissions. If you skip this, the sync will fail.");
      } else if (errorMsg.includes('authentication scopes')) {
        alert("Permissions Missing: When signing in, make sure to check the boxes for 'See, edit, create and delete your Google business listings'. You may need to logout and login again to see these checkboxes.");
      } else if (errorMsg.includes('403') || errorMsg.includes('Google Business Profile API error')) {
        alert("Access Denied: " + errorMsg + "\n\nTroubleshooting checklist:\n1. Enable 'My Business Account Management API'\n2. Enable 'My Business Business Information API'\n3. If your Cloud Project is in 'Testing', ensure your email is added as a Test User.");
      } else {
        alert("Sync Failed: " + errorMsg + "\n\nIf the problem persists, please check your internet connection and try logging in again.");
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
      <div className="min-h-screen bg-[#030305] flex flex-col items-center justify-center gap-6">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-indigo-500/20 rounded-full" />
          <div className="absolute inset-0 w-16 h-16 border-4 border-t-indigo-500 border-r-purple-500 border-b-transparent border-l-transparent rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-indigo-400 font-black text-xl">C</span>
          </div>
        </div>
        <p className="text-slate-600 text-xs font-mono uppercase tracking-widest animate-pulse">Initializing CORTX...</p>
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
      <nav className="w-full md:w-64 bg-[#08080a] border-r border-slate-800/60 p-4 flex flex-col gap-4 md:h-screen sticky top-0 z-50">
        {/* Logo */}
        <div className="flex items-center gap-3 px-2 mb-1 py-2">
          <div className="relative w-10 h-10">
            <div className="absolute inset-0 bg-indigo-600 rounded-xl animate-pulse-glow" />
            <div className="relative w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <span className="font-black text-white text-lg">C</span>
            </div>
          </div>
          <div>
            <h1 className="text-base font-black text-white tracking-tight leading-none">CORTX</h1>
            <p className="text-[10px] text-indigo-400 font-bold tracking-widest">GBP AI</p>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar space-y-0.5">
          {/* Pinned */}
          <p className="sidebar-section-label">Featured</p>
          <SidebarLink 
            icon={<ShieldCheck />} 
            label="Profile Audit" 
            active={activeTab === 'profile-audit'} 
            onClick={() => setActiveTab('profile-audit')} 
            indicator
          />

          <p className="sidebar-section-label">Core</p>
          <SidebarLink 
            icon={<LayoutDashboard />} 
            label="GBP Dashboard" 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')} 
          />
          <SidebarLink 
            icon={<MapPin />} 
            label="Locations" 
            active={activeTab === 'locations'} 
            onClick={() => setActiveTab('locations')} 
          />
          <SidebarLink 
            icon={<BarChart3 />} 
            label="Performance" 
            active={activeTab === 'performance'} 
            onClick={() => setActiveTab('performance')} 
          />

          <p className="sidebar-section-label">Advanced</p>
          <SidebarLink 
            icon={<Calendar />} 
            label="Post Scheduler" 
            active={activeTab === 'post-scheduler'} 
            onClick={() => setActiveTab('post-scheduler')} 
            locked={!isSubscribed}
            onLockedClick={() => setShowSubscriptionModal(true)}
          />
          <SidebarLink 
            icon={<Zap />} 
            label="Advanced Strategy" 
            active={activeTab === 'strategy'} 
            onClick={() => setActiveTab('strategy')} 
            locked={!isSubscribed}
            onLockedClick={() => setShowSubscriptionModal(true)}
          />
          <SidebarLink 
            icon={<FileText />} 
            label="Content & Posts" 
            active={activeTab === 'content'} 
            onClick={() => setActiveTab('content')} 
            locked={!isSubscribed}
            onLockedClick={() => setShowSubscriptionModal(true)}
          />

          <p className="sidebar-section-label">Growth</p>
          <SidebarLink 
            icon={<Share2 />} 
            label="Social Media" 
            active={activeTab === 'social'} 
            onClick={() => setActiveTab('social')} 
            locked={!isSubscribed}
            onLockedClick={() => setShowSubscriptionModal(true)}
          />
          <SidebarLink 
            icon={<FileSearch />} 
            label="Website Analysis" 
            active={activeTab === 'website'} 
            onClick={() => setActiveTab('website')} 
            locked={!isSubscribed}
            onLockedClick={() => setShowSubscriptionModal(true)}
          />
          <SidebarLink 
            icon={<Globe className="text-indigo-400" />} 
            label="SEO Engine" 
            active={activeTab === 'seo-engine'} 
            onClick={() => setActiveTab('seo-engine')} 
            locked={!isSubscribed}
            onLockedClick={() => setShowSubscriptionModal(true)}
          />

          {/* Upgrade Banner */}
          {!isSubscribed && (
            <div className="mt-4 mx-1 p-4 bg-gradient-to-br from-indigo-600/20 to-purple-600/20 border border-indigo-500/25 rounded-2xl">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-black text-white">Go Premium</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed mb-3">Unlock AI scheduling, SEO engine, and advanced strategy tools.</p>
              <button
                onClick={() => setShowSubscriptionModal(true)}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[11px] font-black transition-colors"
              >
                Upgrade — $300/mo
              </button>
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-slate-800/60">
          <div className="flex items-center gap-3 px-2 mb-3">
            <div className="relative shrink-0">
              <img src={user.photoURL || ''} alt="" className="w-9 h-9 rounded-full border-2 border-slate-700" />
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-[#08080a] rounded-full" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate">{user.displayName}</p>
              <p className="text-[10px] text-slate-600 truncate">{user.email}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 text-slate-500 hover:text-white hover:bg-slate-800/40 rounded-xl transition-colors group text-sm"
          >
            <LogOut className="w-4 h-4 group-hover:text-red-400 transition-colors" />
            <span className="font-medium">Sign out</span>
          </button>
        </div>
      </nav>

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Subscription Modal */}
        <AnimatePresence>
          {showSubscriptionModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowSubscriptionModal(false)}
                className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative bg-[#0a0a0c] border border-slate-800 rounded-3xl p-10 max-w-2xl w-full shadow-2xl overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-4">
                  <button onClick={() => setShowSubscriptionModal(false)} className="p-2 text-slate-500 hover:text-white transition-colors">
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="flex flex-col items-center text-center space-y-8">
                  <div className="w-20 h-20 bg-indigo-500/10 rounded-full flex items-center justify-center border border-indigo-500/20">
                    <Sparkles className="w-10 h-10 text-indigo-400" />
                  </div>
                  
                  <div className="space-y-4">
                    <h3 className="text-4xl font-black text-white tracking-tighter">Become a <span className="text-indigo-500">Power Business</span></h3>
                    <p className="text-slate-400 max-w-lg mx-auto leading-relaxed">
                      Upgrade to CORTX Premium to unlock all AI tools, schedule unlimited posts, and access advanced competitor analytics.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full mt-4">
                    <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl text-left border-dashed">
                      <h4 className="font-bold text-white mb-4 text-sm uppercase tracking-widest text-indigo-400">Free Forever</h4>
                      <ul className="space-y-3 text-xs text-slate-500">
                        <li className="flex items-center gap-2"><Check className="w-3 h-3 text-emerald-500" /> Audit Reports</li>
                        <li className="flex items-center gap-2"><Check className="w-3 h-3 text-emerald-500" /> Basic GBP Dashboard</li>
                        <li className="flex items-center gap-2"><Check className="w-3 h-3 text-emerald-500" /> Profile Synchronization</li>
                        <li className="flex items-center gap-2 opacity-30"><X className="w-3 h-3" /> AI Post Generation</li>
                      </ul>
                    </div>
                    <div className="p-6 bg-indigo-600 rounded-2xl text-left shadow-xl shadow-indigo-500/20 relative overflow-hidden">
                      <div className="absolute -top-1 -right-1">
                         <div className="bg-amber-400 text-amber-950 text-[10px] font-black px-2 py-0.5 transform rotate-12">POPULAR</div>
                      </div>
                      <h4 className="font-bold text-white mb-4 text-sm uppercase tracking-widest">Premium Plan</h4>
                      <ul className="space-y-3 text-xs text-indigo-100">
                        <li className="flex items-center gap-2"><Check className="w-3 h-3 text-white" /> AI Review Responses</li>
                        <li className="flex items-center gap-2"><Check className="w-3 h-3 text-white" /> Smart Post Scheduler</li>
                        <li className="flex items-center gap-2"><Check className="w-3 h-3 text-white" /> SEO Engine Access</li>
                        <li className="flex items-center gap-2"><Check className="w-3 h-3 text-white" /> Advanced AI Strategy</li>
                      </ul>
                      <div className="mt-6 flex items-baseline gap-1">
                        <span className="text-2xl font-black text-white">$300</span>
                        <span className="text-xs text-indigo-200">/mo</span>
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={handleUpgrade}
                    disabled={isUpgrading}
                    className="w-full py-5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-2xl font-black transition-all shadow-xl shadow-indigo-500/20 uppercase tracking-widest flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isUpgrading ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      'Get CortX GBP Live and start dominating market'
                    )}
                  </button>
                  <p className="text-[10px] text-slate-600 font-mono">Cancel anytime. 7-day money back guarantee.</p>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Header */}
        <header className="h-16 bg-[#08080a] border-b border-slate-800/60 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            <div className="relative group">
              <button className="flex items-center gap-3 bg-slate-900/70 hover:bg-slate-800/80 px-3 py-2 rounded-xl border border-slate-800 transition-all font-bold min-w-[200px]">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-[10px] font-black shrink-0">BR</div>
                <span className="truncate text-sm">{selectedProfile?.name || 'Select Business'}</span>
                <ChevronRight className="w-4 h-4 ml-auto rotate-90 text-slate-500 shrink-0" />
              </button>
            </div>
            
            <button 
              onClick={syncProfiles}
              disabled={syncing}
              className="flex items-center gap-2 px-3 py-2 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/20 transition-all text-xs font-bold disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync'}
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Notifications */}
            <div className="relative group">
              <button className="relative p-2 text-slate-500 hover:text-white hover:bg-slate-800/60 rounded-xl transition-all">
                <Bell className="w-5 h-5" />
                <div className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-[#08080a]" />
              </button>
              {/* Dropdown */}
              <div className="absolute right-0 top-full mt-2 w-72 bg-[#111114] border border-slate-800 rounded-2xl shadow-2xl z-50 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200 overflow-hidden">
                <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-white">Notifications</span>
                  <span className="badge-indigo">3 new</span>
                </div>
                {[
                  { msg: 'New 5★ review from John S.', time: '2 min ago', dot: 'bg-emerald-500' },
                  { msg: 'Profile audit completed', time: '1 hr ago', dot: 'bg-indigo-500' },
                  { msg: 'Scheduled post published', time: '3 hrs ago', dot: 'bg-purple-500' },
                ].map((n, i) => (
                  <div key={i} className="flex items-start gap-3 p-4 hover:bg-slate-900/50 transition-colors cursor-pointer border-b border-slate-800/50 last:border-0">
                    <div className={`w-2 h-2 rounded-full ${n.dot} mt-1.5 shrink-0`} />
                    <div>
                      <p className="text-xs font-medium text-slate-300">{n.msg}</p>
                      <p className="text-[10px] text-slate-600 mt-0.5">{n.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex items-center gap-3 border-l border-slate-800/60 pl-3 h-10">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-white">{user.displayName}</p>
                <p className="text-[10px] text-slate-600">{user.email?.split('@')[0]}@cortx.ai</p>
              </div>
              <img src={user.photoURL || ''} alt="" className="w-8 h-8 rounded-full object-cover border border-slate-700" />
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 md:p-10 bg-[#0c0c0e] overflow-y-auto custom-scrollbar relative">
          <AnimatePresence mode="wait">
          {activeTab === 'seo-engine' && (
            <motion.div
              key="seo-engine"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <SEODashboard />
            </motion.div>
          )}

          {activeTab === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-10"
            >
              {profiles.length === 0 && (
                <div className="bg-indigo-600 p-8 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl shadow-indigo-500/40">
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                      <Store className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-white">Action Required: Sync Your Business</h3>
                      <p className="text-indigo-100 opacity-80">Connect your Google Business Profile to unlock AI insights and performance tracking.</p>
                    </div>
                  </div>
                  <button 
                    onClick={syncProfiles}
                    disabled={syncing}
                    className="px-8 py-4 bg-white text-indigo-600 rounded-xl font-black hover:scale-105 transition-all shadow-xl flex items-center gap-3 disabled:opacity-50"
                  >
                    {syncing ? <RefreshCw className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                    {syncing ? 'Syncing Locations...' : 'Connect Now'}
                  </button>
                </div>
              )}

              {profiles.length > 0 && auditStatus === 'none' && (
                <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-8 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl shadow-emerald-500/30 border border-emerald-500/20">
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                      <ShieldCheck className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <div className="inline-flex items-center gap-2 px-2 py-0.5 bg-white/20 rounded text-[10px] font-black uppercase text-white mb-2">New Feature</div>
                      <h3 className="text-2xl font-black text-white">Get Your Free Business Audit</h3>
                      <p className="text-emerald-500 bg-white/90 px-2 py-0.5 rounded text-xs font-bold inline-block mb-2">Limited Time Offer</p>
                      <p className="text-emerald-500 bg-white/90 px-2 py-0.5 rounded text-xs font-bold block">Analyze your profile's performance & visibility now.</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setActiveTab('profile-audit')}
                    className="px-8 py-4 bg-white text-emerald-600 rounded-xl font-black hover:scale-105 transition-all shadow-xl flex items-center gap-3"
                  >
                    <Sparkles className="w-5 h-5" />
                    Run Free Audit
                  </button>
                </div>
              )}

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
                  <DashboardAction icon={<HelpCircle />} label="Q & A" onClick={() => setActiveTab('qa')} />
                </div>
              </div>

              {/* Stats and Online Presence */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-[#111114] border border-slate-800 rounded-3xl p-8 relative overflow-hidden">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h3 className="text-2xl font-black text-white mb-1 tracking-tighter">Performance</h3>
                      <p className="text-slate-500 text-sm">Interactions with your profile</p>
                    </div>
                    <button className="px-4 py-2 bg-slate-900 hover:bg-slate-800 rounded-xl text-xs font-bold text-indigo-400 transition-colors border border-slate-800">
                      View Full Report
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-6 mb-6">
                    {[
                      { label: 'Profile Views', value: '1.2k', delta: '+18%', color: 'text-indigo-400' },
                      { label: 'Calls', value: '84', delta: '+6%', color: 'text-emerald-400' },
                      { label: 'Website Clicks', value: '156', delta: '+22%', color: 'text-purple-400' },
                    ].map((item, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                      >
                        <h4 className={`text-3xl font-black mb-1 ${item.color}`}>{item.value}</h4>
                        <p className="text-slate-500 text-xs uppercase tracking-wider font-bold">{item.label}</p>
                        <span className="text-[10px] font-bold text-emerald-400">{item.delta} this month</span>
                      </motion.div>
                    ))}
                  </div>

                  <div className="h-28 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={[
                        {v: 30}, {v: 45}, {v: 25}, {v: 60}, {v: 40}, {v: 80}, {v: 65}
                      ]}>
                        <defs>
                          <linearGradient id="tinyChart" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="v" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#tinyChart)" dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-[#111114] border border-slate-800 rounded-3xl p-6">
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-base font-bold text-white">Live Activity</h3>
                    <span className="badge-live"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />Live</span>
                  </div>
                  <div className="space-y-3">
                    {[
                      { msg: 'New 5★ review received', time: '2m ago', icon: '⭐', color: 'bg-amber-500/10 text-amber-400' },
                      { msg: 'Profile viewed 12 times', time: '15m ago', icon: '👁', color: 'bg-indigo-500/10 text-indigo-400' },
                      { msg: 'Direction request from Maps', time: '1h ago', icon: '📍', color: 'bg-emerald-500/10 text-emerald-400' },
                      { msg: 'Post reached 240 people', time: '3h ago', icon: '📢', color: 'bg-purple-500/10 text-purple-400' },
                      { msg: 'Website click via GBP', time: '5h ago', icon: '🌐', color: 'bg-sky-500/10 text-sky-400' },
                    ].map((item, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.08 }}
                        className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-900/50 transition-colors cursor-default"
                      >
                        <div className={`w-8 h-8 rounded-lg ${item.color} flex items-center justify-center text-sm shrink-0`}>
                          {item.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-300 leading-snug">{item.msg}</p>
                          <p className="text-[10px] text-slate-600 mt-0.5">{item.time}</p>
                        </div>
                      </motion.div>
                    ))}
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
          {activeTab === 'locations' && (
            <motion.div
              key="locations"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <ProfileManagement 
                profiles={profiles} 
                selectedProfile={selectedProfile} 
                setSelectedProfile={setSelectedProfile} 
                syncProfiles={syncProfiles}
                syncing={syncing}
              />
            </motion.div>
          )}

          {activeTab === 'qa' && (
            <motion.div
              key="qa"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {selectedProfile ? (
                 <QAManager profile={selectedProfile} />
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <AlertCircle className="w-16 h-16 text-slate-700 mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Access Denied</h3>
                  <p className="text-slate-400">Please select or create a business profile first.</p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'profile-audit' && (
            <motion.div
              key="profile-audit"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <ProfileAudit 
                profiles={profiles} 
                selectedProfile={selectedProfile} 
                auditStatus={auditStatus}
                auditResult={auditResult}
                onRunAudit={async () => {
                  if (!selectedProfile) return;
                  setAuditStatus('running');
                  try {
                    const result = await analyzeBusinessProfile(selectedProfile);
                    setAuditStatus('completed');
                    setAuditResult(result);
                  } catch (error) {
                    console.error("Audit failed:", error);
                    setAuditStatus('none');
                    alert("Audit failed. Please try again.");
                  }
                }}
                isSubscribed={isSubscribed}
                onSubscribe={() => setShowSubscriptionModal(true)}
              />
            </motion.div>
          )}

          {['social', 'content', 'performance'].includes(activeTab) && (
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
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="fixed bottom-8 right-8 flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-full font-black uppercase tracking-widest shadow-[0_10px_40px_rgba(79,70,229,0.5)] z-50 glow-indigo"
          >
            <Mic className="w-5 h-5" />
            <span className="text-sm">Voice Chat</span>
          </motion.button>
        </main>
      </div>
    </div>
  );
}

function ProfileAudit({ 
  profiles, 
  selectedProfile, 
  auditStatus, 
  auditResult, 
  onRunAudit,
  isSubscribed,
  onSubscribe
}: { 
  profiles: any[], 
  selectedProfile: any, 
  auditStatus: string, 
  auditResult: any, 
  onRunAudit: () => void,
  isSubscribed: boolean,
  onSubscribe: () => void
}) {
  if (profiles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center bg-[#111114] border border-slate-800 rounded-3xl">
        <Store className="w-16 h-16 text-slate-700 mb-6" />
        <h3 className="text-2xl font-bold text-white mb-2">No Profiles Found</h3>
        <p className="text-slate-500 max-w-md mb-8">You need to sync your Google Business Profile first to run an AI audit.</p>
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tighter mb-2">AI Profile <span className="text-indigo-400">Audit</span></h2>
          <p className="text-slate-500">Deep scan of your local search visibility and business reputation.</p>
        </div>
        
        {auditStatus === 'none' && (
          <button 
            onClick={onRunAudit}
            className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black transition-all shadow-xl shadow-indigo-500/20 flex items-center gap-3"
          >
            <Sparkles className="w-5 h-5" />
            Start Free Audit
          </button>
        )}
      </div>

      {auditStatus === 'running' && (
        <div className="bg-[#111114] border border-slate-800 p-12 rounded-3xl flex flex-col items-center justify-center text-center space-y-8">
          <div className="relative">
            <div className="w-24 h-24 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Search className="w-8 h-8 text-indigo-400" />
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-white">Analyzing Your Presence...</h3>
            <p className="text-slate-500 text-sm max-w-xs uppercase tracking-widest font-mono">Checking GBP optimization score</p>
          </div>
          <div className="w-full max-w-md bg-slate-900 h-1.5 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              transition={{ duration: 3 }}
              className="h-full bg-indigo-500" 
            />
          </div>
        </div>
      )}

      {auditStatus === 'completed' && auditResult && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="md:col-span-1 bg-[#111114] border border-slate-800 p-8 rounded-3xl flex flex-col items-center justify-center text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500" />
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">Overall Score</p>
              <div className="relative mb-4">
                <svg className="w-32 h-32 transform -rotate-90">
                  <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-800" />
                  <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={364} strokeDashoffset={364 - (364 * auditResult.score) / 100} className="text-indigo-500" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-3xl font-black text-white">{auditResult.score}</span>
                </div>
              </div>
              <p className="text-xs font-bold text-indigo-400 uppercase">Optimization Needed</p>
            </div>

            <div className="md:col-span-3 bg-indigo-600 p-8 rounded-3xl text-white flex flex-col justify-center">
              <h3 className="text-2xl font-black mb-4">Top Recommendation</h3>
              <p className="text-lg text-indigo-100 font-medium mb-8">"{auditResult.recommendation}"</p>
              <div className="flex flex-wrap gap-3">
                 <div className="px-4 py-2 bg-white/10 rounded-lg text-xs font-bold backdrop-blur-md border border-white/10">SEO Impact: High</div>
                 <div className="px-4 py-2 bg-white/10 rounded-lg text-xs font-bold backdrop-blur-md border border-white/10">Effort: Low</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {auditResult.sections.map((section: any, idx: number) => (
              <div key={idx} className="bg-[#111114] border border-slate-800 p-6 rounded-2xl flex items-start gap-4">
                <div className={`p-3 rounded-xl ${section.status === 'Poor' ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                  {section.score > 70 ? <CheckCircle2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-bold text-white">{section.name}</h4>
                    <span className="text-xs font-black uppercase px-2 py-0.5 bg-slate-900 rounded">{section.score}%</span>
                  </div>
                  <p className="text-sm text-slate-500 mb-2">{section.findings}</p>
                  <div className={`text-[10px] font-black uppercase tracking-widest ${
                    section.status === 'Good' ? 'text-emerald-500' : 
                    section.status === 'Fair' ? 'text-amber-500' : 
                    'text-rose-500'
                  }`}>
                    Status: {section.status}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {!isSubscribed && (
            <div className="bg-gradient-to-br from-indigo-700 to-purple-800 p-10 rounded-3xl text-center space-y-6 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] pointer-events-none" />
              <div className="relative z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full mb-6">
                   <Zap className="w-3 h-3 text-amber-300" />
                   <span className="text-[10px] font-black uppercase tracking-widest text-white">Subscriber Exclusive</span>
                </div>
                <h3 className="text-3xl font-black text-white mb-4">Unlock Full Business Optimization</h3>
                <p className="text-indigo-100 max-w-xl mx-auto mb-10 leading-relaxed text-sm">
                  The audit revealed some critical gaps. Get CORTX Premium to auto-reply to reviews with AI, schedule posts for the month, and access deep competitor SEO insights.
                </p>
                
                <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                  <div className="flex -space-x-4 mb-4 sm:mb-0">
                    {[1, 2, 3, 4].map(i => (
                      <img key={i} src={`https://i.pravatar.cc/150?u=${i}`} className="w-10 h-10 rounded-full border-4 border-indigo-700 object-cover" />
                    ))}
                    <div className="w-10 h-10 rounded-full border-4 border-indigo-700 bg-indigo-900 flex items-center justify-center text-[10px] font-bold text-white">+2.1k</div>
                  </div>
                  <button 
                    onClick={onSubscribe}
                    className="px-10 py-5 bg-white text-indigo-600 rounded-2xl font-black hover:scale-105 transition-all shadow-2xl flex items-center gap-3 animate-bounce"
                  >
                    Subscribe Now to Optimize
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function QAManager({ profile }: { profile: BusinessProfile }) {
  const [qaPairs, setQAPairs] = useState<{ question: string, answer: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'profiles', profile.id, 'qa'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setQAPairs(snapshot.docs.map(doc => doc.data() as { question: string, answer: string }));
    });
    return () => unsubscribe();
  }, [profile.id]);

  async function handleGenerateQA() {
    setLoading(true);
    try {
      const result = await generateQA(profile);
      const parsed = JSON.parse(result);
      if (Array.isArray(parsed)) {
        for (const pair of parsed) {
          await addDoc(collection(db, 'profiles', profile.id, 'qa'), {
            ...pair,
            createdAt: serverTimestamp()
          });
        }
      }
    } catch (error) {
      console.error("QA generation failed:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold mb-1">Q&A Management</h2>
          <p className="text-slate-400">Automate answers to common customer questions for <span className="text-indigo-400">{profile.name}</span></p>
        </div>
        <button 
          onClick={handleGenerateQA}
          disabled={loading}
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50"
        >
          {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
          {loading ? 'Generating...' : 'Generate AI Q&As'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {qaPairs.length > 0 ? qaPairs.map((pair, idx) => (
          <div key={idx} className="bg-[#111114] border border-slate-800 rounded-2xl p-6 space-y-4 hover:border-indigo-500/30 transition-all group">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-indigo-600/10 rounded-lg flex items-center justify-center text-indigo-400 shrink-0">
                <HelpCircle className="w-4 h-4" />
              </div>
              <div className="space-y-2">
                <h4 className="font-bold text-white text-lg leading-tight">{pair.question}</h4>
                <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800 text-sm text-slate-400 leading-relaxed italic">
                  "{pair.answer}"
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
               <button className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white px-2 py-1">Sync to Google</button>
               <button className="text-[10px] font-black uppercase tracking-widest text-rose-500 hover:text-rose-400 px-2 py-1">Delete</button>
            </div>
          </div>
        )) : (
          <div className="md:col-span-2 py-20 bg-[#111114] border border-slate-800 border-dashed rounded-3xl text-center">
            <HelpCircle className="w-12 h-12 text-slate-700 mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">No Q&As yet</h3>
            <p className="text-slate-500 max-w-sm mx-auto">Click generate to let AI create common questions and professional answers based on your business info.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function CheckCircle2({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/>
    </svg>
  );
}

// Update App return to wrap everything in potentially a subscription gate if it's not the dashboard/audit


function LandingPage({ onLogin, isLoading, onNavigate }: { onLogin: () => void, isLoading: boolean, onNavigate: (mode: 'privacy' | 'terms') => void }) {
  return (
    <div className="min-h-screen bg-[#030305] text-slate-100 flex flex-col items-center justify-center p-6 relative overflow-hidden text-center">
      {/* Animated Orbs */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div className="absolute top-[-15%] right-[-5%] w-[50vw] h-[50vw] bg-indigo-700/25 rounded-full blur-[120px] animate-float" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[45vw] h-[45vw] bg-purple-700/20 rounded-full blur-[120px] animate-float-slow" />
        <div className="absolute top-[40%] left-[35%] w-[25vw] h-[25vw] bg-blue-600/10 rounded-full blur-[80px] animate-float" style={{ animationDelay: '3s' }} />
        <div className="absolute top-0 left-0 w-full h-full bg-grid-slate-900 bg-grid-mask" />
      </div>

      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className="max-w-5xl z-10 w-full"
      >
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="inline-flex items-center gap-2.5 px-4 py-1.5 bg-indigo-500/10 border border-indigo-500/25 rounded-full mb-8"
        >
          <span className="flex h-2 w-2 rounded-full bg-indigo-400 animate-pulse" />
          <span className="text-xs font-bold text-indigo-300 tracking-wide">Beta v1.0 � Now Live</span>
          <ChevronRight className="w-3 h-3 text-indigo-400" />
        </motion.div>

        {/* Headline */}
        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.7 }}
          className="text-5xl md:text-7xl lg:text-8xl font-black mb-6 tracking-tighter leading-none"
        >
          <span className="text-white">CORTX </span>
          <span className="gradient-text">GBP AI</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.6 }}
          className="text-lg md:text-xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed"
        >
          The AI-powered command center for your Google Business Profile.
          Respond to reviews, schedule posts, and dominate local search — all powered by Gemini AI.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14"
        >
          <button
            onClick={onLogin}
            disabled={isLoading}
            className="group relative px-10 py-4 btn-primary text-white rounded-2xl font-black text-sm tracking-wide transition-all shadow-2xl shadow-indigo-500/30 flex items-center justify-center gap-3 disabled:opacity-70 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
            {isLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Globe className="w-5 h-5" />}
            {isLoading ? 'Connecting...' : 'Get Started with Google'}
          </button>
          <button
            onClick={() => onNavigate('privacy')}
            className="px-8 py-4 bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 text-slate-300 rounded-2xl font-bold text-sm transition-all"
          >
            Learn More
          </button>
        </motion.div>

        {/* Social Proof */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.65, duration: 0.6 }}
          className="flex flex-wrap items-center justify-center gap-8 mb-16 text-center"
        >
          {[
            { value: '2,100+', label: 'Businesses' },
            { value: '4.9★', label: 'User Rating' },
            { value: '98%', label: 'Uptime SLA' },
            { value: '10M+', label: 'AI Actions' },
          ].map((stat, i) => (
            <div key={i} className="px-6 py-3 bg-slate-900/50 border border-slate-800/60 rounded-2xl">
              <p className="text-2xl font-black text-white">{stat.value}</p>
              <p className="text-xs text-slate-500 font-medium mt-0.5">{stat.label}</p>
            </div>
          ))}
        </motion.div>

        {/* Features Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.75, duration: 0.6 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-left mb-16"
        >
          <FeatureCard title="Free AI Audit" desc="Deep-scan your GBP visibility, reputation, and local SEO gaps instantly." icon={<ShieldCheck className="text-emerald-400" />} />
          <FeatureCard title="AI Review Replies" desc="Generate professional, on-brand responses with Gemini 1.5 Flash in one click." icon={<Sparkles className="text-indigo-400" />} />
          <FeatureCard title="Smart Post Scheduler" desc="AI drafts and schedules posts at peak engagement times across all your locations." icon={<Calendar className="text-purple-400" />} />
          <FeatureCard title="SEO Engine" desc="Programmatically generate and index 1,000+ location landing pages at scale." icon={<Globe className="text-sky-400" />} />
          <FeatureCard title="Performance Analytics" desc="Track views, calls, directions, and website clicks from a single dashboard." icon={<BarChart3 className="text-amber-400" />} />
          <FeatureCard title="Q&A Automation" desc="Auto-answer common customer questions with AI to boost profile engagement." icon={<MessageSquare className="text-pink-400" />} />
        </motion.div>

        {/* Pricing Preview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.85, duration: 0.6 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto mb-16"
        >
          <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl text-left">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Free Forever</p>
            <p className="text-3xl font-black text-white mb-4">$0<span className="text-sm font-medium text-slate-500">/mo</span></p>
            <ul className="space-y-2 text-xs text-slate-400">
              {['AI Profile Audit', 'GBP Dashboard', 'Profile Sync', 'Review Management'].map(f => (
                <li key={f} className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-500" />{f}</li>
              ))}
            </ul>
          </div>
          <div className="p-6 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl text-left relative overflow-hidden shadow-2xl shadow-indigo-500/30">
            <div className="absolute top-3 right-3 px-2 py-0.5 bg-amber-400 text-amber-900 text-[9px] font-black rounded uppercase tracking-wider">Popular</div>
            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200 mb-3">Premium</p>
            <p className="text-3xl font-black text-white mb-4">$300<span className="text-sm font-medium text-indigo-200">/mo</span></p>
            <ul className="space-y-2 text-xs text-indigo-100">
              {['Everything in Free', 'AI Post Scheduler', 'Advanced Strategy', 'SEO Engine Access', 'Social Media Tools'].map(f => (
                <li key={f} className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-white" />{f}</li>
              ))}
            </ul>
          </div>
        </motion.div>

        {/* Technical note */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.95, duration: 0.5 }}
          className="text-sm border border-indigo-500/20 bg-indigo-500/5 p-4 rounded-xl text-indigo-300/80 max-w-2xl mx-auto"
        >
          <strong className="text-indigo-300">Technical Note:</strong> Ensure the <strong>Google Business Profile API</strong> is enabled in your Google Cloud project.
          When signing in, check the boxes to grant profile management permissions.
        </motion.div>
      </motion.div>

      {/* Footer */}
      <footer className="absolute bottom-6 left-0 w-full z-10 px-8 text-center">
        <div className="flex flex-col sm:flex-row justify-center items-center gap-4 text-xs text-slate-600">
          <p>© 2025 CORTX GBP. All rights reserved.</p>
          <div className="flex gap-6">
            <a
              href="https://gbp.cortxai.us/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-300 transition-colors"
            >
              Privacy Policy
            </a>
            <a
              href="https://gbp.cortxai.us/terms-of-service"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-300 transition-colors"
            >
              Terms of Service
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function SidebarLink({ icon, label, active, onClick, indicator, locked, onLockedClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void, indicator?: boolean, locked?: boolean, onLockedClick?: () => void }) {
  return (
    <button 
      onClick={locked ? onLockedClick : onClick}
      className={`relative w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-300 group ${
        active 
          ? 'bg-indigo-600/10 text-white border border-indigo-500/20 shadow-[0_0_20px_rgba(79,70,229,0.1)]' 
          : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800/30'
      } ${locked ? 'opacity-60 cursor-pointer' : ''}`}
    >
      <span className={`w-5 h-5 transition-transform duration-300 ${active ? 'text-indigo-400 scale-110' : 'group-hover:text-slate-300 group-hover:scale-110'}`}>
        {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { className: 'w-full h-full stroke-[2.5]' }) : icon}
      </span>
      <span className={`text-[13px] font-bold tracking-tight transition-colors duration-300 ${active ? 'text-white' : ''}`}>{label}</span>
      
      {indicator && active && (
        <div className="absolute right-3 w-1.5 h-6 bg-indigo-500 rounded-full shadow-[0_0_10px_rgba(79,70,229,0.6)] animate-pulse"></div>
      )}

      {locked && (
        <div className="absolute right-3 text-slate-600">
          <ShieldCheck className="w-3.5 h-3.5" />
        </div>
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
    <motion.div
      whileHover={{ y: -3 }}
      className="glass-card p-6 flex flex-col gap-3 cursor-default"
    >
      <div className="p-2.5 bg-slate-800/60 rounded-xl w-fit">
        {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { className: 'w-5 h-5' }) : icon}
      </div>
      <h3 className="font-bold text-white tracking-tight">{title}</h3>
      <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
    </motion.div>
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

function ProfileManagement({ profiles, selectedProfile, setSelectedProfile, syncProfiles, syncing }: any) {
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

  if (profiles.length === 0 && !isEditing) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Store className="w-20 h-20 text-slate-800 mb-6" />
        <h2 className="text-3xl font-bold mb-4">No Business Profiles Found</h2>
        <p className="text-slate-500 max-w-md mb-10">
          Sync your business locations directly from Google or create one manually to get started with CORTX AI tools.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <button 
            onClick={syncProfiles}
            disabled={syncing}
            className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-3 transition-all disabled:opacity-70"
          >
            {syncing ? <RefreshCw className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
            {syncing ? 'Syncing with Google...' : 'Sync from Google Business'}
          </button>
          <button 
            onClick={() => setIsEditing(true)}
            className="px-8 py-4 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white rounded-2xl font-bold flex items-center justify-center gap-3 transition-all"
          >
            <Plus className="w-5 h-5" /> Add Manually
          </button>
        </div>
        
        <div className="mt-12 p-6 bg-indigo-600/5 rounded-2xl border border-indigo-500/10 text-left max-w-2xl">
          <h4 className="text-sm font-bold text-indigo-400 mb-2 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" /> Why Sync?
          </h4>
          <p className="text-xs text-slate-500 leading-relaxed mb-6">
            Syncing connects CORTX to your official Google Business Profile data. This allows our Gemini AI to respond to real reviews, analyze your rankings, and provide high-accuracy performance reports unique to your local presence.
          </p>
          
          <div className="pt-4 border-t border-slate-800">
            <h4 className="text-xs font-bold text-white mb-3 flex items-center gap-2 uppercase tracking-wider">
              <AlertCircle className="w-3 h-3 text-amber-500" /> Troubleshooting
            </h4>
            <div className="space-y-3 text-[10px] text-slate-400">
              <p>• <strong>Required APIs:</strong> Enable both <strong>"My Business Account Management"</strong> and <strong>"My Business Business Information"</strong> APIs in your Google Cloud Console.</p>
              <p className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20 text-indigo-300">
                • <strong>CRITICAL Permissions:</strong> You MUST manually check the permission boxes for <strong>"See, edit, create and delete your Google business listings"</strong> during the Google login popup. If missed, syncing will fail with authentication errors.
              </p>
              <p>• <strong>OAuth Setup:</strong> If self-hosting, ensure your current domain is in the <strong>"Authorized JavaScript Origins"</strong> list of your OAuth Client ID.</p>
              <p>• If sync returns 0 results but you have locations, try logging out and logging back in to reset permissions.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold mb-1">Business Profiles</h2>
          <p className="text-slate-400">Manage your locations and sync data from Google</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={syncProfiles}
            disabled={syncing}
            className="px-4 py-2 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 rounded-lg text-sm flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} /> Sync
          </button>
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
    if (!profile) return;
    setLoading(true);
    try {
      const result = await generateMarketingStrategy(profile);
      setStrategy(result);
    } catch (error) {
      console.error("Strategy generation failed:", error);
    } finally {
      setLoading(false);
    }
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
  const [filter, setFilter] = useState<'all' | 'positive' | 'negative' | 'pending'>('all');

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

  const avgRating = reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  const ratingCounts = [5,4,3,2,1].map(r => ({ star: r, count: reviews.filter(rv => rv.rating === r).length }));

  const filteredReviews = reviews.filter(r => {
    if (filter === 'positive') return r.rating >= 4;
    if (filter === 'negative') return r.rating <= 2;
    if (filter === 'pending') return !r.response;
    return true;
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tighter mb-1">Customer <span className="gradient-text">Reviews</span></h2>
          <p className="text-slate-500">Managing feedback for <span className="font-bold text-indigo-400">{profile.name}</span></p>
        </div>
        <div className="flex items-center gap-3 px-5 py-3 bg-slate-900 rounded-2xl border border-slate-800">
          <div className="flex gap-0.5">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className={`w-4 h-4 ${i < Math.round(avgRating) ? 'fill-yellow-400 text-yellow-400' : 'text-slate-700'}`} />
            ))}
          </div>
          <span className="text-sm font-black text-white">{avgRating.toFixed(1)}</span>
          <span className="text-xs text-slate-500">({reviews.length} reviews)</span>
        </div>
      </div>

      {/* Rating Distribution */}
      {reviews.length > 0 && (
        <div className="bg-[#111114] border border-slate-800 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Rating Breakdown</h3>
            <div className="space-y-2">
              {ratingCounts.map(({ star, count }) => (
                <div key={star} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-500 w-4">{star}</span>
                  <Star className="w-3 h-3 fill-yellow-400 text-yellow-400 shrink-0" />
                  <div className="flex-1 bg-slate-900 h-2 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: reviews.length > 0 ? `${(count / reviews.length) * 100}%` : '0%' }}
                      transition={{ duration: 0.8 }}
                      className={`h-full rounded-full ${star >= 4 ? 'bg-emerald-500' : star === 3 ? 'bg-amber-500' : 'bg-rose-500'}`}
                    />
                  </div>
                  <span className="text-xs text-slate-500 w-4">{count}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-center">
            <div className="text-center">
              <p className="text-6xl font-black text-white mb-1">{avgRating.toFixed(1)}</p>
              <div className="flex justify-center gap-0.5 mb-2">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className={`w-5 h-5 ${i < Math.round(avgRating) ? 'fill-yellow-400 text-yellow-400' : 'text-slate-700'}`} />
                ))}
              </div>
              <p className="text-xs text-slate-500">{reviews.length} total reviews</p>
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'positive', 'negative', 'pending'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              filter === f
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                : 'bg-slate-900 border border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
          >
            {f} {f === 'all' ? `(${reviews.length})` : f === 'positive' ? `(${reviews.filter(r=>r.rating>=4).length})` : f === 'negative' ? `(${reviews.filter(r=>r.rating<=2).length})` : `(${reviews.filter(r=>!r.response).length})`}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filteredReviews.length > 0 ? filteredReviews.map(review => (
          <motion.div
            key={review.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card rounded-2xl p-6 relative group overflow-hidden"
          >
            {review.response && (
              <div className="absolute top-0 right-0">
                <div className="bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-bl-2xl text-[10px] font-black uppercase flex items-center gap-1">
                  <Check className="w-3 h-3" /> Responded
                </div>
              </div>
            )}
            
            <div className="flex gap-5">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-lg shadow-indigo-500/20">
                {review.reviewerName[0]}
              </div>
              <div className="flex-1 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-white">{review.reviewerName}</h4>
                    <div className="flex gap-0.5 mt-1">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className={`w-3.5 h-3.5 ${i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-slate-700'}`} />
                      ))}
                    </div>
                  </div>
                  <span className="text-xs text-slate-600">2 days ago</span>
                </div>
                
                <p className="text-slate-300 leading-relaxed text-sm italic border-l-2 border-indigo-500/30 pl-4 py-1">
                  "{review.comment}"
                </p>

                {review.response ? (
                  <div className="bg-slate-950/60 p-4 rounded-xl border border-indigo-500/10">
                    <div className="flex items-center gap-2 mb-2">
                      <Store className="w-3 h-3 text-indigo-400" />
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Your Response</span>
                    </div>
                    <p className="text-sm text-slate-400 leading-relaxed">{review.response}</p>
                  </div>
                ) : (
                  <div className="pt-1">
                    {replyingTo === review.id ? (
                      <div className="space-y-3 p-4 bg-slate-900/60 rounded-xl border border-slate-800">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Draft Reply</span>
                          <button 
                            onClick={() => handleAIGenerate(review)}
                            disabled={isGenerating}
                            className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-bold disabled:opacity-50"
                          >
                            <Sparkles className="w-3 h-3" /> {isGenerating ? 'Generating...' : 'AI Draft'}
                          </button>
                        </div>
                        <textarea 
                          value={replyText}
                          onChange={e => setReplyText(e.target.value)}
                          rows={3}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500 resize-none transition-colors"
                          placeholder="Type your response or use AI..."
                        />
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-slate-600">{replyText.length} chars</span>
                          <div className="flex gap-2">
                            <button onClick={() => { setReplyingTo(null); setReplyText(''); }} className="text-xs px-3 py-1.5 text-slate-500 hover:text-white transition-colors">Cancel</button>
                            <button 
                              onClick={() => handleSendReply(review.id)}
                              className="text-xs px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-bold flex items-center gap-1.5 transition-colors"
                            >
                              <Send className="w-3 h-3" /> Send
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button 
                         onClick={() => { setReplyingTo(review.id); setReplyText(''); }}
                         className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-bold flex items-center gap-2 transition-all hover:border-indigo-500/30"
                      >
                         <Sparkles className="w-3 h-3 text-indigo-400" /> Reply with AI
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )) : (
          <div className="text-center py-20 bg-[#111114] rounded-3xl border border-slate-800 border-dashed">
            <MessageSquare className="w-12 h-12 text-slate-700 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-400 mb-1">No reviews found</h3>
            <p className="text-slate-600 text-sm">{filter !== 'all' ? `No ${filter} reviews yet.` : 'No reviews for this profile.'}</p>
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
  const [isGeneratingPost, setIsGeneratingPost] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const profilePosts = posts.filter(p => p.profileId === profile.id);

  async function handleAIGeneratePost() {
    setIsGeneratingPost(true);
    try {
      const suggested = await generatePostContent(profile, "General update and promotion");
      setContent(suggested);
    } catch (error) {
      console.error("Post generation failed:", error);
    } finally {
      setIsGeneratingPost(false);
    }
  }

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
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-bold text-slate-500 uppercase">Post Content</label>
                      <button 
                        onClick={handleAIGeneratePost}
                        disabled={isGeneratingPost}
                        className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 uppercase tracking-widest disabled:opacity-50"
                      >
                        <Sparkles className="w-3 h-3" /> {isGeneratingPost ? 'Drafting...' : 'AI Draft'}
                      </button>
                    </div>
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

