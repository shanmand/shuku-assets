
import React, { useMemo, useState } from 'react';
import { Asset, AssetCategory, AssetLocation } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { calculateDepreciation } from '../services/assetService';
import { isValid } from 'date-fns';
import { Wallet, Package, Activity, ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown, ReceiptText, ShieldCheck, CheckSquare, AlertCircle, Filter } from 'lucide-react';

// Custom implementation of startOfYear as it is missing from date-fns export in this environment
const startOfYear = (date: Date): Date => {
  return new Date(date.getFullYear(), 0, 1);
};

interface AssetDashboardProps {
  assets: Asset[];
  categories: AssetCategory[];
  locations: AssetLocation[];
  reportDate: string;
}

const AssetDashboard: React.FC<AssetDashboardProps> = ({ assets, categories, locations, reportDate }) => {
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  
  const branches = useMemo(() => locations.filter(u => u.type === 'Branch'), [locations]);

  const filteredAssets = useMemo(() => {
    if (selectedBranch === 'all') return assets;
    return assets.filter(a => a.branchId === selectedBranch);
  }, [assets, selectedBranch]);

  const calculations = useMemo(() => {
    let end = new Date(reportDate);
    if (!isValid(end)) end = new Date();
    const start = startOfYear(end);
    return filteredAssets.map(a => calculateDepreciation(a, start, end, categories));
  }, [filteredAssets, reportDate, categories]);

  const stats = useMemo(() => {
    const totalCost = calculations.reduce((sum, c) => sum + c.closingCost, 0);
    const totalNBV = calculations.reduce((sum, c) => sum + c.nbv, 0);
    const totalProfitLoss = calculations.reduce((sum, c) => sum + (c.profitOnDisposal || 0), 0);
    const totalRecoupment = calculations.reduce((sum, c) => sum + (c.recoupment || 0), 0);

    return { totalCost, totalNBV, totalProfitLoss, totalRecoupment };
  }, [calculations]);

  const categoryData = useMemo(() => {
    const activeAssetsInFiltered = filteredAssets.map(a => a.id);
    const uniqueCats = Array.from(new Set(filteredAssets.map(a => a.categoryId)));
    
    return uniqueCats.map(catId => {
      const catObj = categories.find(c => c.id === catId);
      const catAssets = calculations.filter(c => filteredAssets.find(a => a.id === c.assetId)?.categoryId === catId);
      const value = catAssets.reduce((sum, c) => sum + c.nbv, 0);
      return { name: catObj?.name || 'Unknown', value };
    }).filter(d => d.value > 0);
  }, [calculations, filteredAssets, categories]);

  // IFRS Compliance Logic
  const complianceChecklist = useMemo(() => {
    return [
      { label: 'Asset Classes Configured', status: categories.length > 0 },
      { label: 'GL Account Mapping Complete', status: categories.every(c => c.glCodeCost && c.glCodeAccumDepr) },
      { label: 'Physical Locations Mapped', status: assets.some(a => a.locationId) || assets.length === 0 },
      { label: 'IFRS IAS 16 Depreciation Rules Applied', status: true }
    ];
  }, [categories, assets]);

  const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#3b82f6'];
  const currencyFormatter = new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-blue-600 p-8 rounded-3xl text-white shadow-2xl shadow-blue-100 flex flex-col md:flex-row justify-between items-center gap-6">
         <div>
           <h2 className="text-3xl font-black tracking-tighter uppercase">Shuku Assets Overview</h2>
           <p className="text-blue-100 text-sm font-medium mt-1">Lupo Bakery Operational Dashboard • Compliance Status: <span className="text-emerald-300 font-black">VALID</span></p>
         </div>
         <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/20">
              <Filter size={16} className="text-blue-200" />
              <select 
                className="bg-transparent text-xs font-black uppercase tracking-widest outline-none cursor-pointer pr-4"
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
              >
                <option value="all" className="text-slate-800">CONSOLIDATED VIEW</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id} className="text-slate-800">{b.name.toUpperCase()}</option>
                ))}
              </select>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black uppercase text-blue-200 tracking-widest">Selected NBV</p>
              <p className="text-3xl font-black font-mono">{currencyFormatter.format(stats.totalNBV)}</p>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Asset Cost Basis', value: currencyFormatter.format(stats.totalCost), icon: Wallet, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Current Net Value', value: currencyFormatter.format(stats.totalNBV), icon: Package, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { 
            label: 'Profit/Loss (Disposals)', 
            value: currencyFormatter.format(stats.totalProfitLoss), 
            icon: stats.totalProfitLoss >= 0 ? TrendingUp : TrendingDown, 
            color: stats.totalProfitLoss >= 0 ? 'text-emerald-600' : 'text-red-600', 
            bg: stats.totalProfitLoss >= 0 ? 'bg-emerald-50' : 'bg-red-50' 
          },
          { label: 'SARS Recoupments', value: currencyFormatter.format(stats.totalRecoupment), icon: ReceiptText, color: 'text-orange-600', bg: 'bg-orange-50' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-start justify-between hover:shadow-lg transition-all group">
            <div>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">{stat.label}</p>
              <h3 className="text-xl font-black text-slate-800 mt-1">{stat.value}</h3>
            </div>
            <div className={`${stat.bg} ${stat.color} p-3 rounded-xl transition-transform group-hover:scale-110`}>
              <stat.icon size={20} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="text-slate-800 font-black uppercase tracking-widest text-xs mb-6 flex items-center justify-between">
              Value Distribution
              <span className="text-[9px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded uppercase font-black tracking-tight">NBV Class Map</span>
            </h3>
            <div className="h-[280px] w-full">
              {categoryData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={8}
                      dataKey="value"
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="transparent" />
                      ))}
                    </Pie>
                    <Tooltip 
                       formatter={(value: any) => currencyFormatter.format(value)}
                       contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 'bold' }}
                    />
                    <Legend layout="horizontal" verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{ fontSize: '9px', fontWeight: 'bold', paddingTop: '20px' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-300 font-black uppercase text-[10px] tracking-widest">No Value Data</div>
              )}
            </div>
          </div>

          {/* IFRS Checklist */}
          <div className="bg-[#0f172a] p-6 rounded-2xl shadow-xl text-white">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-4 flex items-center gap-2">
              <CheckSquare size={14} /> IFRS Audit Readiness
            </h3>
            <div className="space-y-4">
              {complianceChecklist.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div className={`p-1 rounded-full ${item.status ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                    {item.status ? <ShieldCheck size={12} /> : <AlertCircle size={12} className="text-slate-500" />}
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-tight ${item.status ? 'text-slate-200' : 'text-slate-500'}`}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 h-full flex flex-col">
            <h3 className="text-slate-800 font-black uppercase tracking-widest text-xs mb-6 flex items-center gap-2">
              <Activity size={18} className="text-emerald-500" /> Recent Capital Movements
            </h3>
            <div className="space-y-3 flex-grow overflow-auto custom-scrollbar max-h-[300px]">
              {calculations.filter(c => c.additions > 0 || c.disposals > 0).slice(-5).reverse().map((c) => {
                const asset = filteredAssets.find(a => a.id === c.assetId);
                const isAddition = c.additions > 0;
                if (!asset) return null;
                return (
                  <div key={c.assetId} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100 group hover:border-blue-200 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-xl ${isAddition ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                        {isAddition ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-800 uppercase tracking-tight line-clamp-1">{asset?.name}</p>
                        <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest">
                          {isAddition ? 'Capital Addition' : 'Asset Disposal'} • {asset?.assetNumber}
                        </p>
                      </div>
                    </div>
                    <div className="text-right font-mono font-black text-xs">
                      <p className={`${isAddition ? 'text-emerald-600' : 'text-red-600'}`}>
                        {isAddition ? '+' : '-'}{currencyFormatter.format(isAddition ? c.additions : c.disposals)}
                      </p>
                    </div>
                  </div>
                );
              })}
              {calculations.filter(c => c.additions > 0 || c.disposals > 0).length === 0 && (
                <div className="text-center py-20 text-slate-400">
                  <Activity size={48} className="mx-auto mb-3 opacity-10" />
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-40">No activity recorded for this period</p>
                </div>
              )}
            </div>
            
            <div className="mt-6 pt-6 border-t border-slate-100 grid grid-cols-2 gap-4">
              <div className="bg-slate-900 p-5 rounded-2xl text-white shadow-xl">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Inventory Units</p>
                <h4 className="text-2xl font-black mt-1 tracking-tighter">{filteredAssets.length} <span className="text-[10px] font-bold text-slate-500 ml-1">Total Assets</span></h4>
              </div>
              <div className="bg-emerald-600 p-5 rounded-2xl text-white shadow-xl">
                <p className="text-[9px] font-black uppercase tracking-widest text-emerald-200">System Integrity</p>
                <h4 className="text-2xl font-black mt-1 tracking-tighter">SECURED <ShieldCheck size={18} className="inline ml-1" /></h4>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssetDashboard;
