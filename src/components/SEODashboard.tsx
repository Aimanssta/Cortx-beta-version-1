import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart3, Search, Globe, AlertCircle, RefreshCw,
  Clock, ExternalLink, TrendingUp, TrendingDown, 
  Zap, CheckCircle2, ArrowUpRight, ArrowDownRight,
  Target, FileText, Activity, ChevronRight, Sparkles
} from 'lucide-react';

interface StatsCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down';
  trendValue?: string;
  color?: string;
}

function StatCard({ label, value, subValue, icon, trend, trendValue, color = 'indigo' }: StatsCardProps) {
  const colorMap: Record<string, string> = {
    indigo: 'text-indigo-400 bg-indigo-500/10 group-hover:text-indigo-300',
    emerald: 'text-emerald-400 bg-emerald-500/10 group-hover:text-emerald-300',
    amber: 'text-amber-400 bg-amber-500/10 group-hover:text-amber-300',
    rose: 'text-rose-400 bg-rose-500/10 group-hover:text-rose-300',
  };

  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="bg-[#111114] border border-slate-800 p-6 rounded-2xl hover:border-indigo-500/30 transition-all group cursor-default"
    >
      <div className="flex justify-between items-start mb-4">
        <div className={`p-2.5 rounded-xl ${colorMap[color]} transition-colors`}>
          {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { className: 'w-5 h-5' }) : icon}
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-full ${
            trend === 'up' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
          }`}>
            {trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {trendValue || (trend === 'up' ? '+12%' : '-4%')}
          </div>
        )}
      </div>
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 font-mono">{label}</p>
      <div className="flex items-baseline gap-2">
        <h3 className="text-2xl font-black text-white">{value}</h3>
        {subValue && <span className="text-xs text-slate-600 font-mono">{subValue}</span>}
      </div>
    </motion.div>
  );
}

function RingProgress({ percentage, size = 80, strokeWidth = 8, color = '#6366f1' }: { percentage: number; size?: number; strokeWidth?: number; color?: string }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke="rgba(30,41,59,0.8)" strokeWidth={strokeWidth}
      />
      <motion.circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1.5, ease: "easeOut", delay: 0.3 }}
      />
    </svg>
  );
}

const keywordData = [
  { keyword: "roofing contractor london", pos: 3, prev: 7, volume: "2.4k", difficulty: 67 },
  { keyword: "emergency roof repair", pos: 1, prev: 2, volume: "1.8k", difficulty: 52 },
  { keyword: "local roofer near me", pos: 5, prev: 4, volume: "3.2k", difficulty: 78 },
  { keyword: "flat roof specialists", pos: 8, prev: 12, volume: "890", difficulty: 44 },
  { keyword: "commercial roofing services", pos: 2, prev: 5, volume: "1.1k", difficulty: 61 },
  { keyword: "roof installation cost uk", pos: 11, prev: 9, volume: "2.1k", difficulty: 71 },
];

const recentPages = [
  { location: "London - Central 1", url: "/location/london-central-1", quality: 92, status: "live", time: "3 hrs ago" },
  { location: "Manchester - Didsbury", url: "/location/manchester-didsbury", quality: 87, status: "live", time: "5 hrs ago" },
  { location: "Birmingham - Solihull", url: "/location/birmingham-solihull", quality: 74, status: "pending", time: "8 hrs ago" },
  { location: "Leeds - Headingley", url: "/location/leeds-headingley", quality: 95, status: "live", time: "12 hrs ago" },
  { location: "Bristol - Clifton", url: "/location/bristol-clifton", quality: 41, status: "error", time: "1 day ago" },
];

function getStatusBadge(status: string) {
  if (status === 'live') return (
    <span className="badge-live">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />Live
    </span>
  );
  if (status === 'pending') return (
    <span className="badge-pending">
      <RefreshCw className="w-2.5 h-2.5 animate-spin" />Indexing
    </span>
  );
  return (
    <span className="badge-error">
      <AlertCircle className="w-2.5 h-2.5" />Error
    </span>
  );
}

export function SEODashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'keywords' | 'pages'>('overview');
  const [crawling, setCrawling] = useState(false);
  const [crawlProgress, setCrawlProgress] = useState(78);

  const handleForceCrawl = () => {
    setCrawling(true);
    setCrawlProgress(0);
    const interval = setInterval(() => {
      setCrawlProgress(prev => {
        if (prev >= 100) { clearInterval(interval); setCrawling(false); return 78; }
        return prev + 2;
      });
    }, 60);
  };

  const tabs = ['overview', 'keywords', 'pages'] as const;

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
            <span className="text-[10px] uppercase tracking-widest font-black text-indigo-400">Live Crawl Monitor</span>
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-white">
            Programmatic <span className="gradient-text">SEO Engine</span>
          </h1>
          <p className="text-slate-500 text-sm max-w-lg">
            Automated content generation, schema injection, and indexing monitor for 1,200+ local landing pages.
          </p>
        </div>
        
        <div className="flex gap-3 shrink-0">
          <button className="px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold hover:bg-slate-800 transition-all flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh Data
          </button>
          <button 
            onClick={handleForceCrawl}
            disabled={crawling}
            className="px-4 py-2.5 btn-primary text-white rounded-xl text-xs font-bold shadow-lg transition-all flex items-center gap-2 disabled:opacity-70"
          >
            {crawling ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            {crawling ? 'Crawling...' : 'Force Re-index'}
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Indexed" value="8,421" subValue="/ 10,000" icon={<Globe />} trend="up" trendValue="+342" color="indigo" />
        <StatCard label="Index Ratio" value="84.2%" icon={<Search />} trend="up" trendValue="+2.1%" color="emerald" />
        <StatCard label="Daily Crawls" value="12.4k" subValue="req/24h" icon={<Activity />} trend="up" trendValue="+8%" color="indigo" />
        <StatCard label="Gen Failures" value="14" subValue="retrying..." icon={<AlertCircle />} trend="down" trendValue="-3" color="rose" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-900/60 border border-slate-800 rounded-xl w-fit">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all capitalize ${
              activeTab === tab
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            {/* Main Table */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-[#111114] border border-slate-800 rounded-3xl overflow-hidden">
                <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                  <h3 className="font-bold flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-slate-500" /> Recent Content Generation
                  </h3>
                  <div className="flex gap-2">
                    {['all', 'success', 'error'].map(t => (
                      <button key={t} className="px-3 py-1 text-[10px] uppercase font-black bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800 transition-colors">
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-900/30 text-[10px] uppercase tracking-widest font-black text-slate-600">
                        <th className="px-5 py-3">Location</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3">Quality</th>
                        <th className="px-5 py-3">Crawled</th>
                        <th className="px-5 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-slate-900">
                      {recentPages.map((page, i) => (
                        <motion.tr
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.07 }}
                          className="hover:bg-slate-900/40 transition-colors group"
                        >
                          <td className="px-5 py-4">
                            <div className="flex flex-col">
                              <span className="font-bold text-white text-sm">{page.location}</span>
                              <span className="text-[10px] text-slate-600 font-mono">{page.url}</span>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            {getStatusBadge(page.status)}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-20 h-1.5 bg-slate-900 rounded-full overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${page.quality}%` }}
                                  transition={{ duration: 1, delay: i * 0.1 }}
                                  className={`h-full rounded-full ${
                                    page.quality >= 80 ? 'bg-gradient-to-r from-indigo-500 to-purple-500' :
                                    page.quality >= 60 ? 'bg-gradient-to-r from-amber-500 to-orange-500' :
                                    'bg-gradient-to-r from-rose-500 to-red-500'
                                  }`}
                                />
                              </div>
                              <span className="text-xs font-bold text-slate-400">{page.quality}%</span>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <span className="text-xs text-slate-500">{page.time}</span>
                          </td>
                          <td className="px-5 py-4">
                            <button className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-600 hover:text-indigo-400 transition-colors">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Queue Status */}
              <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl p-7 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-8 translate-x-8" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full translate-y-8 -translate-x-4" />
                <h3 className="text-lg font-black text-white mb-1 relative z-10">Queue Status</h3>
                <p className="text-indigo-100/70 text-xs mb-5 relative z-10">BullMQ processing 1.2M jobs</p>
                
                <div className="space-y-3 relative z-10">
                  <div className="flex justify-between text-xs font-bold text-indigo-200">
                    <span>Progress</span>
                    <span>{crawlProgress}%</span>
                  </div>
                  <div className="h-2 bg-indigo-900/40 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-white rounded-full shadow-[0_0_12px_rgba(255,255,255,0.5)]"
                      animate={{ width: `${crawlProgress}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-2">
                    {[
                      { label: 'Waiting', value: '4.2k' },
                      { label: 'Active', value: '128' },
                      { label: 'Failed', value: '12' },
                    ].map(item => (
                      <div key={item.label} className="text-center bg-white/5 rounded-xl p-3">
                        <p className="text-[10px] font-bold text-indigo-200 mb-1">{item.label}</p>
                        <p className="text-lg font-black text-white">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Quality Checks */}
              <div className="bg-[#111114] border border-slate-800 rounded-3xl p-6 space-y-5">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">Quality Integrity Checks</h4>
                <div className="space-y-3">
                  {[
                    { label: "Duplicate Meta Detection", status: "Active", ok: true },
                    { label: "Placeholder Validator", status: "Active", ok: true },
                    { label: "Schema.org Validation", status: "Active", ok: true },
                    { label: "Thin Content Filter", status: "1 Warning", ok: false },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-xl border border-slate-800/60">
                      <div className="flex items-center gap-2.5">
                        {item.ok
                          ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          : <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        }
                        <span className="text-xs font-medium text-slate-300">{item.label}</span>
                      </div>
                      <span className={`text-[10px] font-black uppercase ${item.ok ? 'text-emerald-400' : 'text-amber-400'}`}>{item.status}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI Suggestion */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-900/50 border border-indigo-500/20 rounded-3xl p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <h4 className="font-bold text-white text-sm">AI Insight</h4>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  Adding FAQ schema to your top 50 location pages could increase click-through rate by an estimated <span className="text-indigo-400 font-bold">18-24%</span>.
                </p>
                <button className="text-[11px] font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors">
                  Apply to All Pages <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'keywords' && (
          <motion.div
            key="keywords"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className="bg-[#111114] border border-slate-800 rounded-3xl overflow-hidden">
              <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                <h3 className="font-bold flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-indigo-400" /> Keyword Position Tracker
                </h3>
                <span className="badge-indigo">Live Rankings</span>
              </div>
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-900/30 text-[10px] uppercase tracking-widest font-black text-slate-600">
                    <th className="px-6 py-4">Keyword</th>
                    <th className="px-6 py-4">Position</th>
                    <th className="px-6 py-4">Change</th>
                    <th className="px-6 py-4">Volume</th>
                    <th className="px-6 py-4">Difficulty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900">
                  {keywordData.map((kw, i) => {
                    const delta = kw.prev - kw.pos;
                    const improved = delta > 0;
                    return (
                      <motion.tr
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.07 }}
                        className="hover:bg-slate-900/40 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <span className="font-medium text-slate-200 text-sm">{kw.keyword}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-2xl font-black text-white">#{kw.pos}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className={`flex items-center gap-1 font-bold text-sm ${improved ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {improved ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                            {improved ? `+${delta}` : delta}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-bold text-slate-300">{kw.volume}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-16 h-1.5 bg-slate-900 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${kw.difficulty >= 70 ? 'bg-rose-500' : kw.difficulty >= 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                style={{ width: `${kw.difficulty}%` }}
                              />
                            </div>
                            <span className="text-xs text-slate-500">{kw.difficulty}</span>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {activeTab === 'pages' && (
          <motion.div
            key="pages"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            {[
              { label: "Avg Quality Score", value: 78, color: '#6366f1' },
              { label: "Schema Coverage", value: 91, color: '#10b981' },
              { label: "Mobile Optimized", value: 85, color: '#8b5cf6' },
            ].map((item, i) => (
              <div key={i} className="bg-[#111114] border border-slate-800 rounded-3xl p-8 flex flex-col items-center text-center">
                <div className="relative mb-4">
                  <RingProgress percentage={item.value} size={96} color={item.color} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xl font-black text-white">{item.value}%</span>
                  </div>
                </div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{item.label}</p>
              </div>
            ))}
            <div className="md:col-span-3 bg-[#111114] border border-slate-800 rounded-3xl p-6">
              <h3 className="font-bold text-white mb-6 flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" /> Page Quality Distribution
              </h3>
              <div className="space-y-4">
                {[
                  { label: "Excellent (90-100%)", count: 3241, total: 8421, color: "bg-emerald-500" },
                  { label: "Good (70-89%)", count: 3180, total: 8421, color: "bg-indigo-500" },
                  { label: "Fair (50-69%)", count: 1680, total: 8421, color: "bg-amber-500" },
                  { label: "Poor (<50%)", count: 320, total: 8421, color: "bg-rose-500" },
                ].map((item, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-400">{item.label}</span>
                      <span className="text-white">{item.count.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(item.count / item.total) * 100}%` }}
                        transition={{ duration: 1, delay: i * 0.15 }}
                        className={`${item.color} h-full rounded-full`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
