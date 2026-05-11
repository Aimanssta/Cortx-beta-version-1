import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  BarChart3, 
  Search, 
  Globe, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw,
  Clock,
  ExternalLink,
  ChevronDown
} from 'lucide-react';

interface StatsCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down';
}

function StatCard({ label, value, subValue, icon, trend }: StatsCardProps) {
  return (
    <div className="bg-[#111114] border border-slate-800 p-6 rounded-2xl hover:border-indigo-500/30 transition-all group">
      <div className="flex justify-between items-start mb-4">
        <div className="p-2 bg-slate-900 rounded-xl text-slate-400 group-hover:text-indigo-400 transition-colors">
          {icon}
        </div>
        {trend && (
          <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${trend === 'up' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
            {trend === 'up' ? '+12%' : '-4%'}
          </span>
        )}
      </div>
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1 font-mono">{label}</p>
      <div className="flex items-baseline gap-2">
        <h3 className="text-2xl font-black text-white">{value}</h3>
        {subValue && <span className="text-xs text-slate-600 font-mono">{subValue}</span>}
      </div>
    </div>
  );
}

export function SEODashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'queue' | 'quality'>('overview');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8 pt-24 font-sans">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-2 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-md">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
              <span className="text-[10px] uppercase tracking-widest font-bold text-indigo-400">Live Crawl Monitor</span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tighter text-white">Programmatic <span className="text-indigo-500">SEO Engine</span></h1>
            <p className="text-slate-500 max-w-lg text-sm">Automated content generation, schema injection, and indexing monitor for 1,200+ local landing pages.</p>
          </div>
          
          <div className="flex gap-3">
            <button className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs font-bold hover:bg-slate-800 transition-all flex items-center gap-2">
              <RefreshCw className="w-3 h-3" /> Refresh Data
            </button>
            <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-xs font-bold text-white shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2">
              <RefreshCw className="w-3 h-3" /> Force Re-index
            </button>
          </div>
        </div>

        {/* Primary Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatCard 
            label="Total Indexed" 
            value="8,421" 
            subValue="/ 10,000"
            icon={<Globe className="w-5 h-5" />} 
            trend="up"
          />
          <StatCard 
            label="Index Ratio" 
            value="84.2%" 
            icon={<Search className="w-5 h-5" />} 
          />
          <StatCard 
            label="Daily Crawls" 
            value="12.4k" 
            subValue="requests/24h"
            icon={<BarChart3 className="w-5 h-5" />} 
          trend="up"
          />
          <StatCard 
            label="Gen Failures" 
            value="14" 
            subValue="retrying..."
            icon={<AlertCircle className="w-5 h-5" />} 
            trend="down"
          />
        </div>

        {/* Dashboard Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Table Area */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-[#111114] border border-slate-800 rounded-3xl overflow-hidden">
              <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                <h3 className="font-bold flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-500" /> Recent Content Generation
                </h3>
                <div className="flex gap-2">
                  {['all', 'success', 'error'].map(t => (
                    <button key={t} className="px-3 py-1 text-[10px] uppercase font-black bg-slate-900 border border-slate-800 rounded-md hover:bg-slate-800">
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-900/50 text-[10px] uppercase tracking-widest font-black text-slate-500">
                      <th className="px-6 py-4">Location</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Crawl State</th>
                      <th className="px-6 py-4">Quality Score</th>
                      <th className="px-6 py-4">Action</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm divide-y divide-slate-900">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <tr key={i} className="hover:bg-slate-900/40 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-white underline decoration-indigo-500/30">London - Central {i}</span>
                            <span className="text-[10px] text-slate-500 font-mono">/location/london-central-{i}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            <span className="text-xs font-bold text-emerald-400">Live</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs text-slate-400">3 hours ago</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="w-24 h-1.5 bg-slate-900 rounded-full overflow-hidden">
                            <div className="w-4/5 h-full bg-gradient-to-r from-indigo-500 to-purple-500" />
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <button className="p-2 hover:bg-slate-800 rounded-lg text-slate-500 transition-colors">
                            <ExternalLink className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Sidebar Area */}
          <div className="space-y-6">
            <div className="bg-indigo-600 rounded-3xl p-8 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                <RefreshCw className="w-32 h-32" />
              </div>
              <h3 className="text-2xl font-black text-white mb-2 relative z-10">Queue Status</h3>
              <p className="text-indigo-100 text-sm mb-6 relative z-10">BullMQ is processing 1.2M jobs in the background.</p>
              
              <div className="space-y-4 relative z-10">
                <div className="flex justify-between text-xs font-bold text-indigo-200">
                  <span>Progress</span>
                  <span>78%</span>
                </div>
                <div className="h-2 bg-indigo-900/30 rounded-full overflow-hidden">
                  <div className="w-[78%] h-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.5)]" />
                </div>
                <div className="flex gap-4 pt-4">
                  <div className="flex-1 text-center">
                    <p className="text-xs font-bold text-indigo-200">Waiting</p>
                    <p className="text-xl font-black text-white">4.2k</p>
                  </div>
                  <div className="flex-1 text-center">
                    <p className="text-xs font-bold text-indigo-200">Failed</p>
                    <p className="text-xl font-black text-white">12</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#111114] border border-slate-800 rounded-3xl p-6">
              <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-6">Quality Integrity Checks</h4>
              <div className="space-y-4">
                {[
                  { label: "Duplicate Meta Detection", status: "Active" },
                  { label: "Placeholder Validator", status: "Active" },
                  { label: "Schema.org Validation", status: "Active" }
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-xl border border-slate-800">
                    <span className="text-xs font-bold text-slate-300">{item.label}</span>
                    <span className="text-[10px] font-black uppercase text-emerald-400">{item.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
