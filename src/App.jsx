import React, { useState, useEffect, useMemo } from 'react';
// Papaparse is no longer needed on the frontend as the server handles CSV parsing
import {
  TrendingUp,
  ShoppingBag,
  DollarSign,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCcw,
  Search,
  Filter,
  Download,
  Calendar,
  ChevronDown,
  Zap,
  Sparkles,
  AlertCircle,
  Lightbulb,
  Target,
  BrainCircuit
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import { GoogleGenerativeAI } from "@google/generative-ai";

// --- UTILITIES ---
const formatCurrency = (val) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(val);
};

// --- SUB-COMPONENTS ---
const KPICard = ({ title, value, icon: Icon, trend, trendValue, colorClass, gradientClass }) => (
  <div className="relative overflow-hidden bg-slate-900/40 border border-slate-800/60 rounded-3xl p-6 hover:border-slate-700/80 transition-all duration-500 group backdrop-blur-sm shadow-xl">
    <div className={`absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8 opacity-10 blur-3xl rounded-full ${gradientClass}`}></div>
    <div className="flex justify-between items-start relative z-10 mb-6">
      <div className={`p-3 rounded-2xl ${colorClass} bg-opacity-10 text-opacity-100 flex items-center justify-center`}>
        <Icon className="w-6 h-6" />
      </div>
      <div className={`flex items-center px-2 py-1 rounded-full text-xs font-bold tracking-tight ${trend === 'up' ? 'text-emerald-400 bg-emerald-400/10' : 'text-rose-400 bg-rose-400/10'}`}>
        {trend === 'up' ? <ArrowUpRight className="w-3.5 h-3.5 mr-1" /> : <ArrowDownRight className="w-3.5 h-3.5 mr-1" />}
        {trendValue}
      </div>
    </div>
    <div className="relative z-10">
      <h3 className="text-slate-400 text-sm font-semibold mb-2 uppercase tracking-wider">{title}</h3>
      <p className="text-3xl font-black text-white tracking-tighter group-hover:scale-[1.02] transition-transform origin-left">{value}</p>
    </div>
  </div>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 border border-slate-700 p-4 rounded-xl shadow-2xl backdrop-blur-md">
        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-2">{label}</p>
        <p className="text-white text-lg font-black">{formatCurrency(payload[0].value)}</p>
      </div>
    );
  }
  return null;
};

// --- MAIN DASHBOARD ---
const Dashboard = () => {
  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedProduct, setSelectedProduct] = useState('All Products');
  const [selectedChannel, setSelectedChannel] = useState('All Channels');
  const [searchQuery, setSearchQuery] = useState('');

  // AI Config
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');
  const [aiInsights, setAiInsights] = useState(null);
  const [generatingAi, setGeneratingAi] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/sales');
        const data = await response.json();

        setRawData(data);
        if (data.length > 0) {
          const dates = data.map(d => d.date).sort();
          setDateRange({
            start: dates[0],
            end: dates[dates.length - 1]
          });
        }
        setLoading(false);
      } catch (error) {
        console.error("Error fetching data:", error);
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Filter Logic
  const filteredData = useMemo(() => {
    return rawData.filter(row => {
      const matchProduct = selectedProduct === 'All Products' || row.product === selectedProduct;
      const matchChannel = selectedChannel === 'All Channels' || row.channel === selectedChannel;
      const matchDate = (!dateRange.start || row.date >= dateRange.start) &&
        (!dateRange.end || row.date <= dateRange.end);
      const matchSearch = !searchQuery ||
        row.product.toLowerCase().includes(searchQuery.toLowerCase()) ||
        row.channel.toLowerCase().includes(searchQuery.toLowerCase());

      return matchProduct && matchChannel && matchDate && matchSearch;
    });
  }, [rawData, selectedProduct, selectedChannel, dateRange, searchQuery]);

  // Insights Calculations
  const businessInsights = useMemo(() => {
    if (filteredData.length === 0) return null;

    // 1. Best Product (by Revenue)
    const productRev = filteredData.reduce((acc, r) => {
      acc[r.product] = (acc[r.product] || 0) + (r.revenue || 0);
      return acc;
    }, {});
    const bestProduct = Object.entries(productRev).sort((a, b) => b[1] - a[1])[0];

    // 2. Best Channel (by Revenue)
    const channelRev = filteredData.reduce((acc, r) => {
      acc[r.channel] = (acc[r.channel] || 0) + (r.revenue || 0);
      return acc;
    }, {});
    const bestChannel = Object.entries(channelRev).sort((a, b) => b[1] - a[1])[0];

    // 3. Highest Revenue Day
    const dayRev = filteredData.reduce((acc, r) => {
      acc[r.date] = (acc[r.date] || 0) + (r.revenue || 0);
      return acc;
    }, {});
    const bestDay = Object.entries(dayRev).sort((a, b) => b[1] - a[1])[0];

    // 4. Highest Conversion Rate Channel (Orders/Visitors)
    const channelConv = filteredData.reduce((acc, r) => {
      if (!acc[r.channel]) acc[r.channel] = { orders: 0, v: 0 };
      acc[r.channel].orders += (r.orders || 0);
      acc[r.channel].v += (r.visitors || 1);
      return acc;
    }, {});
    const bestConv = Object.entries(channelConv)
      .map(([name, stats]) => ({ name, rate: stats.orders / stats.v }))
      .sort((a, b) => b.rate - a.rate)[0];

    return {
      bestProduct: { name: bestProduct[0], val: formatCurrency(bestProduct[1]) },
      bestChannel: { name: bestChannel[0], val: formatCurrency(bestChannel[1]) },
      bestDay: { name: bestDay[0], val: formatCurrency(bestDay[1]) },
      bestConv: { name: bestConv.name, rate: (bestConv.rate * 100).toFixed(1) + '%' }
    };
  }, [filteredData]);

  // KPI Calculations
  const kpis = useMemo(() => {
    const totalRevenue = filteredData.reduce((sum, row) => sum + (Number(row.revenue) || 0), 0);
    const totalOrders = filteredData.reduce((sum, row) => sum + (Number(row.orders) || 0), 0);
    const totalCost = filteredData.reduce((sum, row) => sum + (Number(row.cost) || 0), 0);
    const totalProfit = totalRevenue - totalCost;
    const aov = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    return { totalRevenue, totalOrders, totalProfit, aov };
  }, [filteredData]);

  // Chart Data Preparation
  const trendData = useMemo(() => {
    const daily = filteredData.reduce((acc, row) => {
      acc[row.date] = (acc[row.date] || 0) + row.revenue;
      return acc;
    }, {});
    return Object.entries(daily).map(([date, revenue]) => ({ date, revenue })).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredData]);

  const channelDataArr = useMemo(() => {
    const byChannel = filteredData.reduce((acc, row) => {
      acc[row.channel] = (acc[row.channel] || 0) + row.revenue;
      return acc;
    }, {});
    return Object.entries(byChannel).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredData]);

  // AI Generation Logic
  const generateAiBusinessInsights = async () => {
    if (!apiKey || apiKey === 'your_api_key_here') {
      alert("Gemini API Key is not configured in the .env file.");
      return;
    }
    setGeneratingAi(true);
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: selectedModel });

      const dataSummary = {
        totalRevenue: kpis.totalRevenue,
        totalOrders: kpis.totalOrders,
        totalProfit: kpis.totalProfit,
        bestProduct: businessInsights.bestProduct.name,
        bestChannel: businessInsights.bestChannel.name,
        bestConvChannel: businessInsights.bestConv.name,
        recentTrend: trendData.slice(-5)
      };

      const prompt = `
        As a senior business analyst, analyze this sales data:
        ${JSON.stringify(dataSummary)}
        
        Generate concise business insights in exactly this JSON format:
        {
          "alerts": ["insight 1", "insight 2"],
          "opportunities": ["insight 1", "insight 2"],
          "suggestions": ["insight 1", "insight 2"]
        }
        Keep each insight short, professional, and clear.
      `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      // Basic JSON cleaning if model adds markdown blocks
      const cleanedJson = text.replace(/```json|```/g, '').trim();
      setAiInsights(JSON.parse(cleanedJson));
    } catch (error) {
      console.error("AI Error:", error);
      let errorMsg = "Failed to generate AI insights.";
      if (error.message?.includes("429")) {
        errorMsg = "Free Tier Rate Limit reached. Please wait a minute or switch to a 'Lite' model.";
      } else if (error.message?.includes("403") || error.message?.includes("API key")) {
        errorMsg = "Invalid API Key. Please check your .env file and restart the dev server.";
      }
      alert(errorMsg);
    } finally {
      setGeneratingAi(false);
    }
  };

  const offerings = useMemo(() => ['All Products', ...new Set(rawData.map(d => d.product))], [rawData]);
  const channels = useMemo(() => ['All Channels', ...new Set(rawData.map(d => d.channel))], [rawData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-blue-500/10 border-t-blue-500 rounded-full animate-spin mb-6"></div>
          <p className="text-slate-400 text-lg font-black tracking-[0.2em] animate-pulse uppercase">Syncing Intelligence...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 p-6 md:p-10 font-sans selection:bg-blue-500/30">
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[150px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/5 blur-[120px] rounded-full"></div>
      </div>

      <div className="max-w-[1600px] mx-auto">
        {/* Header Section */}
        <div className="flex flex-col xl:flex-row xl:items-end justify-between mb-10 gap-8">
          <div>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl shadow-2xl shadow-blue-500/30 flex items-center justify-center">
                <BarChart3 className="w-8 h-8 text-white" />
              </div>
              <div>
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.4em] block mb-1">Global Operations Console</span>
                <h1 className="text-5xl font-black text-white tracking-tightest leading-none">
                  Revenue <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-cyan-400 bg-clip-text text-transparent">Optimization</span>
                </h1>
              </div>
            </div>
          </div>

          {/* AI Settings Overlay Toggle Style */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-1.5 flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-3">System Model</span>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-400 focus:outline-none"
              >
                <optgroup label="Stable Models (Free Tier)" className="bg-slate-900 text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                  <option value="gemini-2.5-flash" className="text-slate-200 uppercase font-bold py-1">Gemini 2.5 Flash</option>
                  <option value="gemini-2.0-flash" className="text-slate-200 uppercase font-bold py-1">Gemini 2.0 Flash</option>
                </optgroup>
                <optgroup label="Latest Previews (Experimental)" className="bg-slate-900 text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                  <option value="gemini-3.1-flash-lite" className="text-slate-200 uppercase font-bold py-1">Gemini 3.1 Flash-Lite</option>
                  <option value="gemini-3.1-pro" className="text-slate-200 uppercase font-bold py-1">Gemini 3.1 Pro</option>
                </optgroup>
                <optgroup label="Pro Models (Quota Limited)" className="bg-slate-900 text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                  <option value="gemini-2.5-pro" className="text-slate-200 uppercase font-bold py-1">Gemini 2.5 Pro</option>
                </optgroup>
              </select>
            </div>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="bg-slate-900/40 border border-slate-800/60 p-2.5 rounded-[2.5rem] backdrop-blur-2xl flex flex-wrap items-center gap-3 shadow-2xl mb-10">
          <div className="flex items-center gap-3 px-5 py-3.5 bg-slate-950/50 rounded-2xl border border-slate-800/40">
            <Calendar className="w-4 h-4 text-slate-500" />
            <input type="date" value={dateRange.start} onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))} className="bg-transparent text-xs font-black text-slate-300 focus:outline-none cursor-pointer uppercase tracking-wider" />
            <span className="text-slate-700 font-black">/</span>
            <input type="date" value={dateRange.end} onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))} className="bg-transparent text-xs font-black text-slate-300 focus:outline-none cursor-pointer uppercase tracking-wider" />
          </div>
          <div className="relative min-w-[180px]">
            <select value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)} className="bg-slate-950/50 border border-slate-800/40 rounded-2xl px-5 py-3.5 text-xs font-black text-slate-300 focus:outline-none appearance-none w-full uppercase tracking-wider">
              {offerings.map(p => <option key={p} value={p} className="bg-slate-900">{p}</option>)}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-500 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          <div className="relative min-w-[180px]">
            <select value={selectedChannel} onChange={(e) => setSelectedChannel(e.target.value)} className="bg-slate-950/50 border border-slate-800/40 rounded-2xl px-5 py-3.5 text-xs font-black text-slate-300 focus:outline-none appearance-none w-full uppercase tracking-wider">
              {channels.map(c => <option key={c} value={c} className="bg-slate-900">{c}</option>)}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-500 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          <button onClick={() => { setSelectedProduct('All Products'); setSelectedChannel('All Channels'); }} className="p-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl transition-all shadow-lg shadow-blue-600/20"><RefreshCcw className="w-5 h-5" /></button>
        </div>

        {/* Insights Grid & Stats */}
        <div className="grid grid-cols-12 gap-8 mb-10">

          {/* Main Insights (Static) */}
          <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
            <h2 className="text-xs font-black text-slate-500 uppercase tracking-[0.4em] mb-2 px-2 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" /> Operational Highlights
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-[2rem] hover:border-slate-700 transition-colors group">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Top Performer</span>
                <p className="text-white font-black text-lg line-clamp-1">{businessInsights?.bestProduct.name}</p>
                <p className="text-blue-400 text-xs font-bold mt-1">{businessInsights?.bestProduct.val} Total Revenue</p>
              </div>
              <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-[2rem] hover:border-slate-700 transition-colors group">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Winning Channel</span>
                <p className="text-white font-black text-lg">{businessInsights?.bestChannel.name}</p>
                <p className="text-purple-400 text-xs font-bold mt-1">{businessInsights?.bestChannel.val} Contributed</p>
              </div>
              <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-[2rem] hover:border-slate-700 transition-colors group">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Peak Velocity Day</span>
                <p className="text-white font-black text-lg">{businessInsights?.bestDay.name}</p>
                <p className="text-emerald-400 text-xs font-bold mt-1">{businessInsights?.bestDay.val} Records</p>
              </div>
              <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-[2rem] hover:border-slate-700 transition-colors group">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Max Conversion</span>
                <p className="text-white font-black text-lg">{businessInsights?.bestConv.name}</p>
                <p className="text-amber-400 text-xs font-bold mt-1">{businessInsights?.bestConv.rate} Target Ratio</p>
              </div>
            </div>

            {/* Main KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 mt-2">
              <KPICard title="Net Revenue" value={formatCurrency(kpis.totalRevenue)} icon={DollarSign} trend="up" trendValue="+12.5%" colorClass="text-blue-400 bg-blue-600" gradientClass="bg-blue-600" />
              <KPICard title="Orders" value={kpis.totalOrders.toLocaleString()} icon={ShoppingBag} trend="up" trendValue="+8.2%" colorClass="text-indigo-400 bg-indigo-600" gradientClass="bg-indigo-600" />
              <KPICard title="Contribution" value={formatCurrency(kpis.totalProfit)} icon={TrendingUp} trend="up" trendValue="+14.1%" colorClass="text-emerald-400 bg-emerald-600" gradientClass="bg-emerald-600" />
              <KPICard title="Ticket Size" value={formatCurrency(kpis.aov)} icon={BarChart3} trend="down" trendValue="-2.4%" colorClass="text-amber-400 bg-amber-600" gradientClass="bg-amber-600" />
            </div>
          </div>

          {/* AI Insights Panel */}
          <div className="col-span-12 lg:col-span-4 bg-gradient-to-br from-indigo-900/20 to-blue-900/10 border border-indigo-500/20 rounded-[3rem] p-8 backdrop-blur-xl relative overflow-hidden flex flex-col h-full shadow-2xl">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-black text-white flex items-center gap-3">
                  <BrainCircuit className="w-6 h-6 text-indigo-400" />
                  Gemini <span className="text-indigo-400">Analyst</span>
                </h2>
                <button
                  onClick={generateAiBusinessInsights}
                  disabled={generatingAi}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white p-3 rounded-2xl shadow-xl shadow-indigo-600/30 transition-all active:scale-95"
                >
                  {generatingAi ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                </button>
              </div>

              {!aiInsights && !generatingAi && (
                <div className="flex flex-col items-center justify-center py-10 opacity-60">
                  <div className="w-16 h-16 bg-indigo-500/10 rounded-full flex items-center justify-center mb-4">
                    <Target className="w-8 h-8 text-indigo-500/50" />
                  </div>
                  <p className="text-slate-400 text-sm font-bold text-center">Ready to analyze performance data.<br />Click pulse to generate insights.</p>
                </div>
              )}

              {generatingAi && (
                <div className="flex flex-col items-center justify-center py-10 space-y-4">
                  <div className="w-full h-1.5 bg-indigo-950 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 animate-[loading_2s_ease-in-out_infinite]"></div>
                  </div>
                  <p className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.3em]">Processing Neural Insights...</p>
                </div>
              )}

              {aiInsights && (
                <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                  <div>
                    <h3 className="text-[10px] font-black text-rose-400 uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
                      <AlertCircle className="w-3 h-3" /> Critical Alerts
                    </h3>
                    <ul className="space-y-3">
                      {aiInsights.alerts.map((a, i) => (
                        <li key={i} className="bg-rose-500/5 border border-rose-500/10 p-4 rounded-2xl text-xs font-bold text-slate-300 leading-relaxed">{a}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
                      <Target className="w-3 h-3" /> Growth Ops
                    </h3>
                    <ul className="space-y-3">
                      {aiInsights.opportunities.map((o, i) => (
                        <li key={i} className="bg-indigo-500/5 border border-indigo-500/10 p-4 rounded-2xl text-xs font-bold text-slate-300 leading-relaxed">{o}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
                      <Lightbulb className="w-3 h-3" /> Strategic Fixes
                    </h3>
                    <ul className="space-y-3">
                      {aiInsights.suggestions.map((s, i) => (
                        <li key={i} className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-2xl text-xs font-bold text-slate-300 leading-relaxed">{s}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Charts & Table Row */}
        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-12 xl:col-span-8 bg-slate-900/30 border border-slate-800/60 rounded-[3rem] p-10 shadow-2xl h-[500px]">
            <div className="mb-10 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black text-white mb-2">Revenue Dynamics</h2>
                <p className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] opacity-80">Daily performance metrics</p>
              </div>
            </div>
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} /><stop offset="95%" stopColor="#3b82f6" stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} strokeOpacity={0.5} />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 900 }} dy={15} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 900 }} tickFormatter={(value) => `$${value / 1000}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#colorRevenue)" animationDuration={2000} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="col-span-12 xl:col-span-4 bg-slate-900/30 border border-slate-800/60 rounded-[3rem] p-10 shadow-2xl h-[500px]">
            <div className="mb-10">
              <h2 className="text-2xl font-black text-white mb-2">Channel Share</h2>
              <p className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] opacity-80">Market penetration</p>
            </div>
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={channelDataArr} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} strokeOpacity={0.5} />
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#cbd5e1', fontSize: 11, fontWeight: 900 }} width={80} />
                  <Tooltip cursor={{ fill: 'rgba(59,130,246,0.05)' }} content={<CustomTooltip />} />
                  <Bar dataKey="value" radius={[0, 10, 10, 0]} barSize={36}>
                    {channelDataArr.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? '#3b82f6' : index === 1 ? '#6366f1' : '#8b5cf6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="col-span-12 bg-slate-900/40 border border-slate-800/60 rounded-[3rem] overflow-hidden shadow-2xl">
            <div className="p-10 border-b border-slate-800/60 flex flex-col xl:flex-row xl:items-center justify-between gap-8 bg-slate-900/10">
              <div><h2 className="text-2xl font-black text-white mb-1">Transaction Ledger</h2><p className="text-sm font-black text-slate-500 uppercase tracking-[0.3em] opacity-80">Hyper-granular verification data stream</p></div>
              <div className="flex flex-col sm:flex-row gap-5">
                <div className="relative group">
                  <Search className="w-5 h-5 absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                  <input type="text" placeholder="Search ledger..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-slate-950/90 border border-slate-800/80 rounded-2xl pl-14 pr-8 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all w-full sm:w-80 font-black placeholder:text-slate-600" />
                </div>
              </div>
            </div>
            <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr className="bg-slate-950/60 border-b border-slate-800/80"><th className="px-10 py-6 text-[10px] font-black text-slate-600 uppercase tracking-[0.4em]">Timestamp</th><th className="px-10 py-6 text-[10px] font-black text-slate-600 uppercase tracking-[0.4em]">Product</th><th className="px-10 py-6 text-[10px] font-black text-slate-600 uppercase tracking-[0.4em]">Channel</th><th className="px-10 py-6 text-[10px] font-black text-slate-600 uppercase tracking-[0.4em] text-right">Vol</th><th className="px-10 py-6 text-[10px] font-black text-slate-600 uppercase tracking-[0.4em] text-right">Value</th><th className="px-10 py-6 text-[10px] font-black text-slate-600 uppercase tracking-[0.4em] text-right">Net</th></tr></thead><tbody className="divide-y divide-slate-800/40">{filteredData.slice(0, 10).map((row, idx) => (<tr key={idx} className="hover:bg-blue-600/[0.04] transition-all group/row"><td className="px-10 py-7 text-sm text-slate-500 font-black">{row.date}</td><td className="px-10 py-7"><span className="text-sm text-white font-black">{row.product}</span></td><td className="px-10 py-7"><span className="text-[9px] font-black uppercase text-slate-400">{row.channel}</span></td><td className="px-10 py-7 text-sm text-slate-400 font-black text-right">{row.orders}</td><td className="px-10 py-7 text-sm text-white font-black text-right">{formatCurrency(row.revenue)}</td><td className="px-10 py-7 text-right"><span className="text-sm text-emerald-400 font-black">{formatCurrency(row.revenue - row.cost)}</span></td></tr>))}</tbody></table></div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
      `}</style>
    </div>
  );
};

export default Dashboard;
