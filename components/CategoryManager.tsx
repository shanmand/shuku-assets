
import React, { useState } from 'react';
import { AssetCategory, TaxStrategy, DatabaseConfig } from '../types';
import { 
  Settings, Plus, Trash2, Save, Apple, Copy, Check, Zap, 
  ArrowUpCircle, ArrowDownCircle, RefreshCw, DatabaseBackup
} from 'lucide-react';

interface CategoryManagerProps {
  categories: AssetCategory[];
  onUpdate: (categories: AssetCategory[]) => void;
  dbConfig: DatabaseConfig;
  onUpdateDb: (config: DatabaseConfig) => void;
  onForcePush?: () => void;
  onForcePull?: () => void;
  onTestConnection?: () => void;
  connectionStatus?: {status: 'idle' | 'success' | 'error' | 'connecting', message?: string};
  syncLoading?: boolean;
}

const CategoryManager: React.FC<CategoryManagerProps> = ({ 
  categories, onUpdate, dbConfig, onUpdateDb, onForcePush, onForcePull, onTestConnection, connectionStatus, syncLoading 
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [localCategories, setLocalCategories] = useState<AssetCategory[]>(categories);
  const [copied, setCopied] = useState(false);

  const sqlSchema = `-- DATABASE SETUP
CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, name TEXT, "defaultUsefulLife" NUMERIC, "defaultTaxRate" NUMERIC, "residualPercentage" NUMERIC, "taxStrategy" TEXT, "glCodeCost" TEXT, "glCodeAccumDepr" TEXT, "glCodeDeprExpense" TEXT);
CREATE TABLE IF NOT EXISTS locations (id TEXT PRIMARY KEY, name TEXT, code TEXT, type TEXT, "parentId" TEXT);
CREATE TABLE IF NOT EXISTS assets (id TEXT PRIMARY KEY, "assetNumber" TEXT, "tagId" TEXT, name TEXT, description TEXT, "categoryId" TEXT, "branchId" TEXT, "locationId" TEXT, "subLocationId" TEXT, status TEXT, components JSONB);`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(sqlSchema);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const addCategory = () => {
    const newCat: AssetCategory = {
      id: Math.random().toString(36).substr(2, 9),
      name: 'New Class',
      defaultUsefulLife: 5,
      defaultTaxRate: 20,
      residualPercentage: 0,
      taxStrategy: TaxStrategy.STANDARD_FLAT,
      glCodeCost: '1000/000',
      glCodeAccumDepr: '1000/001',
      glCodeDeprExpense: '5000/000'
    };
    setLocalCategories([...localCategories, newCat]);
    setEditingId(newCat.id);
  };

  const updateCategory = (id: string, updates: Partial<AssetCategory>) => {
    setLocalCategories(localCategories.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const handleSave = () => {
    onUpdate(localCategories);
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    if (confirm("Delete this asset class?")) {
      const updated = localCategories.filter(c => c.id !== id);
      setLocalCategories(updated);
      onUpdate(updated);
    }
  };

  return (
    <div className="space-y-12 pb-20">
      <section className="bg-slate-900 rounded-3xl p-8 text-white shadow-2xl relative border border-slate-800">
        <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-8">
          <div>
            <h2 className="text-xl font-black uppercase tracking-widest flex items-center gap-2"><Apple size={20} className="text-blue-400" /> Database Engine</h2>
            <p className="text-slate-400 text-xs font-medium mt-1">Configure your Supabase/Postgres connection.</p>
          </div>
          <button onClick={onTestConnection} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${connectionStatus?.status === 'error' ? 'bg-red-600' : 'bg-slate-800 hover:bg-slate-700'}`}>
            {syncLoading ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />} Verify Link
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-2">
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Endpoint URL</label>
            <input type="text" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm font-mono text-white outline-none" value={dbConfig.supabaseUrl} onChange={e => onUpdateDb({ ...dbConfig, supabaseUrl: e.target.value })} />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Service Key</label>
            <input type="password" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm font-mono text-white outline-none" value={dbConfig.supabaseKey} onChange={e => onUpdateDb({ ...dbConfig, supabaseKey: e.target.value })} />
          </div>
          <div className="flex items-end">
            <button onClick={() => onUpdateDb({ ...dbConfig, enabled: !dbConfig.enabled })} className={`w-full py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${dbConfig.enabled ? 'bg-emerald-600' : 'bg-slate-700'}`}>{dbConfig.enabled ? 'Engine Active' : 'Enable Link'}</button>
          </div>
        </div>
        
        <div className="mt-8 pt-8 border-t border-slate-800 grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <h4 className="text-xs font-black uppercase text-white mb-4 flex items-center gap-2"><DatabaseBackup size={18} className="text-blue-400" /> Maintenance</h4>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={onForcePush} className="bg-blue-600/10 border border-blue-500/20 hover:bg-blue-600/20 p-4 rounded-2xl text-left transition-all">
                <p className="text-[10px] font-black text-blue-400 uppercase mb-1">Push Overwrite</p>
                <div className="flex items-center justify-between text-white font-black text-[10px] uppercase">Local → Cloud <ArrowUpCircle size={16} /></div>
              </button>
              <button onClick={onForcePull} className="bg-slate-950 border border-slate-800 hover:bg-slate-900 p-4 rounded-2xl text-left transition-all">
                <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Pull Restore</p>
                <div className="flex items-center justify-between text-white font-black text-[10px] uppercase">Cloud → Local <ArrowDownCircle size={16} /></div>
              </button>
            </div>
          </div>
          <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50">
            <button onClick={copyToClipboard} className="w-full flex items-center justify-center gap-2 bg-slate-900 border border-slate-700 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase text-white hover:bg-black transition-all">
              {copied ? <Check size={14} className="text-blue-400" /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy Table SQL'}
            </button>
          </div>
        </div>
      </section>

      <div className="space-y-6">
        <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div><h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Settings className="text-blue-600" /> Asset Classes</h2><p className="text-sm text-slate-500">Configure depreciation rules.</p></div>
          <button onClick={addCategory} className="bg-[#1e3a5f] text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-2 hover:bg-blue-900 shadow-md"><Plus size={16} /> New Class</button>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {localCategories.map(cat => (
            <div key={cat.id} className={`bg-white border rounded-2xl p-6 transition-all ${editingId === cat.id ? 'ring-2 ring-blue-500 border-transparent shadow-xl' : 'border-slate-200'}`}>
              <div className="grid grid-cols-1 lg:grid-cols-6 gap-6 items-start">
                <div className="lg:col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">Class Name</label>
                  <input type="text" className="w-full text-base font-bold bg-transparent border-b-2 border-slate-100 outline-none" value={cat.name} onChange={e => updateCategory(cat.id, { name: e.target.value })} />
                </div>
                <div className="lg:col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">Tax Strategy</label>
                  <select className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold outline-none" value={cat.taxStrategy} onChange={e => updateCategory(cat.id, { taxStrategy: e.target.value as TaxStrategy })}>
                    {Object.values(TaxStrategy).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="flex justify-end items-center gap-2 pt-4 lg:col-span-2">
                  <button onClick={() => setEditingId(editingId === cat.id ? null : cat.id)} className="px-4 py-2 bg-slate-100 rounded-lg text-[10px] font-black uppercase">{editingId === cat.id ? 'Close' : 'GL Mapping'}</button>
                  {editingId === cat.id && <button onClick={handleSave} className="p-2 bg-blue-600 text-white rounded-lg"><Save size={18} /></button>}
                  <button onClick={() => handleDelete(cat.id)} className="p-2 text-slate-300 hover:text-red-500"><Trash2 size={18} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CategoryManager;
