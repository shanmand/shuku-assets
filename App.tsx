import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { MOCK_ASSETS, ASSET_CATEGORIES, ORGANIZATIONAL_UNITS } from './constants';
import { Asset, AssetStatus, AuditLog, AssetLocation, AssetCategory, DatabaseConfig } from './types';
import AssetDashboard from './components/AssetDashboard';
import AssetForm from './components/AssetForm';
import ReportingSuite from './components/ReportingSuite';
import AuditTrailView from './components/AuditTrailView';
import ScannerModal from './components/ScannerModal';
import JournalManager from './components/JournalManager';
import ImportManager from './components/ImportManager';
import CategoryManager from './components/CategoryManager';
import LocationManager from './components/LocationManager';
import { createClient } from '@supabase/supabase-js';
import { 
  LayoutDashboard, 
  Database, 
  Map, 
  FileBarChart, 
  Plus, 
  History,
  Scan,
  BookMarked,
  FileUp,
  Settings,
  ShieldCheck,
  Cloud,
  CloudOff,
  RefreshCw,
  CloudUpload,
  CalendarDays,
  UserCircle,
  ChevronDown,
  CheckCircle,
  Search,
  X,
  Filter,
  Trash2,
  AlertTriangle,
  CheckSquare,
  Square,
  Hammer,
  MapPin
} from 'lucide-react';
import { format, startOfYear } from 'date-fns';

type Tab = 'dashboard' | 'register' | 'locations' | 'reports' | 'journals' | 'import' | 'audit' | 'settings';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [syncLoading, setSyncLoading] = useState(false);
  const [isAutoSyncing, setIsAutoSyncing] = useState(false);
  const [hasSyncedInitial, setHasSyncedInitial] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{status: 'idle' | 'success' | 'error' | 'connecting', message?: string}>({status: 'idle'});
  
  const [currentUser, setCurrentUser] = useState<string>(() => {
    return localStorage.getItem('shuku_current_user') || 'Admin';
  });
  const [isChangingUser, setIsChangingUser] = useState(false);

  const now = new Date();
  const [startDate, setStartDate] = useState(format(startOfYear(now), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(now, 'yyyy-MM-dd'));

  const [assets, setAssets] = useState<Asset[]>(() => {
    const saved = localStorage.getItem('shuku_assets_v2');
    return saved ? JSON.parse(saved) : MOCK_ASSETS;
  });
  
  const [categories, setCategories] = useState<AssetCategory[]>(() => {
    const saved = localStorage.getItem('shuku_categories_v2');
    return saved ? JSON.parse(saved) : ASSET_CATEGORIES;
  });
  
  const [locations, setLocations] = useState<AssetLocation[]>(() => {
    const saved = localStorage.getItem('shuku_locations_v2');
    return saved ? JSON.parse(saved) : ORGANIZATIONAL_UNITS;
  });

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    const saved = localStorage.getItem('shuku_audit_v2');
    return saved ? JSON.parse(saved) : [];
  });

  const [dbConfig, setDbConfig] = useState<DatabaseConfig>(() => {
    const saved = localStorage.getItem('shuku_db_config_v2');
    return saved ? JSON.parse(saved) : { enabled: false, supabaseUrl: '', supabaseKey: '' };
  });

  const supabase = useMemo(() => {
    if (dbConfig.enabled && dbConfig.supabaseUrl && dbConfig.supabaseKey) {
      try {
        return createClient(dbConfig.supabaseUrl, dbConfig.supabaseKey, {
          auth: { persistSession: false }
        });
      } catch (e) {
        return null;
      }
    }
    return null;
  }, [dbConfig.enabled, dbConfig.supabaseUrl, dbConfig.supabaseKey]);

  const pullFromPostgres = useCallback(async (force = false) => {
    if (!supabase) return;
    setSyncLoading(true);
    setConnectionStatus({status: 'connecting'});
    
    try {
      const fetchAllTableData = async (table: string) => {
        let results: any[] = [];
        let from = 0;
        let to = 999;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase.from(table).select('*').range(from, to);
          if (error) throw error;
          
          if (data && data.length > 0) {
            results = [...results, ...data];
            if (data.length < 1000) {
              hasMore = false;
            } else {
              from += 1000;
              to += 1000;
            }
          } else {
            hasMore = false;
          }
        }
        return results;
      };

      const [catData, locData, assetData] = await Promise.all([
        fetchAllTableData('categories'),
        fetchAllTableData('locations'),
        fetchAllTableData('assets')
      ]);

      if (catData && catData.length > 0) setCategories(catData);
      if (locData && locData.length > 0) setLocations(locData);
      if (assetData && assetData.length > 0) setAssets(assetData);
      
      setDbConfig(prev => ({ ...prev, lastSync: new Date().toISOString() }));
      setHasSyncedInitial(true);
      setConnectionStatus({status: 'success', message: 'Engine Online'});
      
      if (force) alert(`PULL SUCCESS. Synced ${assetData.length} assets with cloud.`);
    } catch (err: any) {
      console.error("Critical Sync Fault:", err);
      setConnectionStatus({status: 'error', message: 'Connection Error'});
      if (force) alert("SYNC ERROR: System could not reach database or encountered a timeout.");
    } finally {
      setSyncLoading(false);
    }
  }, [supabase]);

  const pushToPostgres = useCallback(async (isAuto = false) => {
    if (!supabase || !dbConfig.enabled || !hasSyncedInitial) return;

    if (isAuto) setIsAutoSyncing(true);
    else setSyncLoading(true);

    try {
      await Promise.all([
        supabase.from('categories').upsert(categories),
        supabase.from('locations').upsert(locations),
        supabase.from('assets').upsert(assets)
      ]);
      setDbConfig(prev => ({ ...prev, lastSync: new Date().toISOString() }));
    } catch (err: any) {
      console.error("Push Error", err);
    } finally {
      setIsAutoSyncing(false);
      setSyncLoading(false);
    }
  }, [supabase, assets, categories, locations, dbConfig.enabled, hasSyncedInitial]);

  useEffect(() => {
    if (dbConfig.enabled && supabase && !hasSyncedInitial) {
      pullFromPostgres(false);
    }
  }, [dbConfig.enabled, supabase, hasSyncedInitial, pullFromPostgres]);

  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!dbConfig.enabled || !supabase || !hasSyncedInitial) return;
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(() => pushToPostgres(true), 3000);
    return () => { if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current); };
  }, [assets, categories, locations, dbConfig.enabled, supabase, pushToPostgres, hasSyncedInitial]);

  useEffect(() => {
    localStorage.setItem('shuku_assets_v2', JSON.stringify(assets));
    localStorage.setItem('shuku_categories_v2', JSON.stringify(categories));
    localStorage.setItem('shuku_locations_v2', JSON.stringify(locations));
    localStorage.setItem('shuku_audit_v2', JSON.stringify(auditLogs));
    localStorage.setItem('shuku_db_config_v2', JSON.stringify(dbConfig));
    localStorage.setItem('shuku_current_user', currentUser);
  }, [assets, categories, locations, auditLogs, dbConfig, currentUser]);

  const [editingAsset, setEditingAsset] = useState<Asset | undefined>();
  const [isScanning, setIsScanning] = useState(false);

  const logAction = (assetId: string, action: string, changes: any[]) => {
    const newLog: AuditLog = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      userId: currentUser,
      assetId,
      action,
      changes
    };
    setAuditLogs(prev => [...prev, newLog]);
  };

  const handleSaveAsset = (newAsset: Asset) => {
    if (editingAsset && editingAsset.id) {
      setAssets(assets.map(a => a.id === newAsset.id ? newAsset : a));
      logAction(newAsset.id, 'UPDATE', [{ field: 'Asset Details', oldValue: 'Modified', newValue: 'Current' }]);
    } else {
      setAssets([...assets, newAsset]);
      logAction(newAsset.id, 'CREATE', [{ field: 'Asset', oldValue: 'N/A', newValue: newAsset.name }]);
    }
    setEditingAsset(undefined);
    setActiveTab('register');
  };

  const handleDeleteAsset = (id: string) => {
    const asset = assets.find(a => a.id === id);
    if (!asset) return;
    
    if (confirm(`Are you sure you want to PERMANENTLY delete "${asset.name}"? This action cannot be undone and is only intended for data-entry errors.`)) {
      setAssets(prev => prev.filter(a => a.id !== id));
      logAction(id, 'DELETE', [{ field: 'Record', oldValue: asset.name, newValue: 'REMOVED' }]);
      if (editingAsset?.id === id) setEditingAsset(undefined);
    }
  };

  const handleBulkDelete = (ids: string[]) => {
    if (ids.length === 0) return;
    if (confirm(`CRITICAL ACTION: Are you sure you want to PERMANENTLY delete ${ids.length} selected records?`)) {
      setAssets(prev => prev.filter(a => !ids.includes(a.id)));
      logAction('BULK', 'DELETE_BATCH', [{ field: 'Count', oldValue: ids.length, newValue: 0 }]);
    }
  };

  const handleBulkScrap = (ids: string[], date: string) => {
    setAssets(prev => prev.map(a => {
      if (ids.includes(a.id)) {
        return {
          ...a,
          status: AssetStatus.SCRAPPED,
          components: a.components.map(c => ({
            ...c,
            status: AssetStatus.SCRAPPED,
            disposalDate: date,
            disposalProceeds: 0
          }))
        };
      }
      return a;
    }));
    logAction('BULK', 'SCRAP_BATCH', [{ field: 'Count', oldValue: ids.length, newValue: `Scrapped on ${date}` }]);
  };

  const handleBulkMove = (ids: string[], branchId: string, locationId: string, subLocationId: string) => {
    setAssets(prev => prev.map(a => {
      if (ids.includes(a.id)) {
        return { ...a, branchId, locationId, subLocationId };
      }
      return a;
    }));
    logAction('BULK', 'MOVE_BATCH', [{ field: 'Location Update', oldValue: 'Multiple', newValue: 'Relocated' }]);
  };

  const handleDeleteAll = () => {
    const verification = prompt('WARNING: You are about to wipe the entire Asset Registry. Type "DELETE ALL" to confirm:');
    if (verification === 'DELETE ALL') {
      setAssets([]);
      logAction('SYSTEM', 'PURGE_ALL', [{ field: 'Registry', oldValue: 'Full', newValue: 'Empty' }]);
    }
  };

  const currencyFormatter = new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' });

  return (
    <div className="min-h-screen flex bg-[#f8fafc]">
      <aside className="no-print w-64 bg-[#0f172a] text-white flex flex-col shrink-0 border-r border-slate-800">
        <div className="p-6 border-b border-slate-800 bg-[#1e293b]">
          <h1 className="text-xl font-black flex items-center gap-2 tracking-tighter">
            <ShieldCheck className="text-emerald-400" size={24} /> SHUKU ASSETS
          </h1>
          <p className="text-[9px] text-emerald-400 uppercase font-black tracking-widest mt-1">Lupo Bakery Edition</p>
        </div>
        
        <nav className="flex-grow p-4 space-y-1">
          <SectionTitle>Operations</SectionTitle>
          <NavItem active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={LayoutDashboard} label="Dashboard" />
          <NavItem active={activeTab === 'register'} onClick={() => setActiveTab('register')} icon={Database} label="Asset Register" />
          <NavItem active={activeTab === 'locations'} onClick={() => setActiveTab('locations')} icon={Map} label="Locations" />
          <SectionTitle>Compliance</SectionTitle>
          <NavItem active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} icon={FileBarChart} label="IFRS & SARS Reports" />
          <NavItem active={activeTab === 'journals'} onClick={() => setActiveTab('journals')} icon={BookMarked} label="GL Journals" />
          <SectionTitle>System</SectionTitle>
          <NavItem active={activeTab === 'import'} onClick={() => setActiveTab('import')} icon={FileUp} label="Bulk Data Import" />
          <NavItem active={activeTab === 'audit'} onClick={() => setActiveTab('audit')} icon={History} label="Audit Trail" />
          <NavItem active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={Settings} label="System Config" />
        </nav>

        <div className="p-6 mt-auto border-t border-slate-800 bg-[#1e293b]/50">
          <div className="flex flex-col gap-1">
              {dbConfig.enabled ? (
                <>
                  <span className={`text-[10px] font-bold uppercase flex items-center gap-1.5 ${connectionStatus.status === 'error' ? 'text-red-400' : 'text-emerald-400'}`}>
                    {(isAutoSyncing || syncLoading) ? <RefreshCw size={12} className="animate-spin" /> : <Cloud size={12} />}
                    {isAutoSyncing ? 'Syncing...' : connectionStatus.status === 'error' ? 'Offline' : 'Connected'}
                  </span>
                  {dbConfig.lastSync && <span className="text-[8px] text-slate-500">Last: {format(new Date(dbConfig.lastSync), 'HH:mm')}</span>}
                </>
              ) : (
                <span className="text-[10px] text-slate-500 font-bold uppercase flex items-center gap-1.5"><CloudOff size={12} /> Local Storage</span>
              )}
          </div>
        </div>
      </aside>

      <main className="flex-grow flex flex-col overflow-hidden">
        <header className="no-print bg-white border-b border-slate-200 h-16 flex items-center justify-between px-8 shrink-0 shadow-sm z-10">
          <div className="flex items-center gap-6">
            <h2 className="text-slate-800 font-black text-sm uppercase tracking-widest min-w-[120px]">
              {activeTab === 'settings' ? 'System Settings' : activeTab.replace('register', 'Asset Register')}
            </h2>
            
            {(activeTab === 'dashboard' || activeTab === 'reports' || activeTab === 'journals') && (
              <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                <CalendarDays size={14} className="text-slate-400" />
                <div className="flex items-center gap-1">
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent text-[10px] font-bold text-slate-600 outline-none w-28 uppercase"/>
                  <span className="text-slate-300 text-xs">→</span>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent text-[10px] font-bold text-slate-600 outline-none w-28 uppercase"/>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4">
               <div className="flex items-center gap-2 relative">
                  {isChangingUser ? (
                    <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl border border-blue-200 shadow-sm">
                      <input autoFocus type="text" value={currentUser} onChange={(e) => setCurrentUser(e.target.value)} onBlur={() => setIsChangingUser(false)} className="bg-transparent text-xs font-black uppercase tracking-widest outline-none w-32"/>
                      <button onClick={() => setIsChangingUser(false)} className="text-blue-600 hover:text-blue-800"><CheckCircle size={14} /></button>
                    </div>
                  ) : (
                    <button onClick={() => setIsChangingUser(true)} className="flex items-center gap-3 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 group transition-all">
                      <div className="bg-white p-1 rounded-full shadow-sm text-slate-400 group-hover:text-blue-600"><UserCircle size={16} /></div>
                      <div className="text-left">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Logged as</p>
                        <p className="text-[10px] font-black text-slate-700 uppercase tracking-tighter flex items-center gap-1">{currentUser} <ChevronDown size={10} className="text-slate-300" /></p>
                      </div>
                    </button>
                  )}
               </div>
               <div className="h-8 w-[1px] bg-slate-200"></div>
               <div className="flex items-center gap-2">
                 <button onClick={() => setIsScanning(true)} className="text-slate-500 hover:text-blue-600 p-2 transition-colors bg-slate-50 rounded-lg border border-slate-200"><Scan size={20} /></button>
                 <button onClick={() => { setEditingAsset({} as Asset); setActiveTab('register'); }} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg"><Plus size={18} /> Add Asset</button>
               </div>
            </div>
          </div>
        </header>

        <div className="flex-grow overflow-auto p-8 custom-scrollbar">
          {editingAsset ? (
            <AssetForm asset={editingAsset.id ? editingAsset : undefined} onSave={handleSaveAsset} onCancel={() => setEditingAsset(undefined)} onDelete={handleDeleteAsset} existingAssets={assets} categories={categories} locations={locations} />
          ) : (
            <>
              {activeTab === 'dashboard' && <AssetDashboard assets={assets} categories={categories} locations={locations} reportDate={endDate} />}
              {activeTab === 'register' && (
                <AssetTable 
                  assets={assets} 
                  onEdit={setEditingAsset} 
                  onDelete={handleDeleteAsset} 
                  onBulkDelete={handleBulkDelete}
                  onBulkScrap={handleBulkScrap}
                  onBulkMove={handleBulkMove}
                  onDeleteAll={handleDeleteAll}
                  currencyFormatter={currencyFormatter} 
                  categories={categories} 
                  locations={locations}
                />
              )}
              {activeTab === 'locations' && <LocationManager locations={locations} onUpdate={setLocations} assets={assets} />}
              {activeTab === 'reports' && <ReportingSuite assets={assets} categories={categories} locations={locations} startDate={startDate} endDate={endDate} />}
              {activeTab === 'journals' && <JournalManager assets={assets} categories={categories} locations={locations} selectedMonth={format(new Date(endDate), 'yyyy-MM')} />}
              {activeTab === 'import' && <ImportManager categories={categories} locations={locations} onImport={(a) => setAssets([...assets, ...a])} />}
              {activeTab === 'audit' && <AuditTrailView logs={auditLogs} assets={assets} />}
              {activeTab === 'settings' && <CategoryManager categories={categories} onUpdate={setCategories} dbConfig={dbConfig} onUpdateDb={setDbConfig} onForcePush={() => pushToPostgres(false)} onForcePull={() => pullFromPostgres(true)} onTestConnection={() => pullFromPostgres(true)} connectionStatus={connectionStatus} syncLoading={syncLoading} />}
            </>
          )}
        </div>
      </main>

      {isScanning && <ScannerModal onScan={(id) => { const a = assets.find(x => x.tagId === id); if(a) setEditingAsset(a); setIsScanning(false); }} onClose={() => setIsScanning(false)} />}
    </div>
  );
};

const SectionTitle: React.FC<React.PropsWithChildren<{}>> = ({ children }) => (
  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest pt-6 pb-2 px-4 border-t border-slate-800/50 mt-4 first:mt-0 first:border-0">{children}</p>
);

const NavItem = ({ active, onClick, icon: Icon, label }: any) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
    <Icon size={18} /> <span className="text-xs font-bold uppercase tracking-tight">{label}</span>
  </button>
);

const AssetTable = ({ assets, onEdit, onDelete, onBulkDelete, onBulkScrap, onBulkMove, onDeleteAll, currencyFormatter, categories, locations }: any) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showScrapPicker, setShowScrapPicker] = useState(false);
  const [scrapDate, setScrapDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [showMovePicker, setShowMovePicker] = useState(false);
  
  const [moveBranchId, setMoveBranchId] = useState('');
  const [moveLocId, setMoveLocId] = useState('');
  const [moveSubLocId, setMoveSubLocId] = useState('');

  const filteredAssets = useMemo(() => {
    if (!searchTerm.trim()) return assets;
    const term = searchTerm.toLowerCase().trim();
    return assets.filter((a: Asset) => {
      const category = categories.find((c: any) => c.id === a.categoryId);
      const categoryName = category?.name.toLowerCase() || '';
      return (
        a.assetNumber.toLowerCase().includes(term) ||
        a.name.toLowerCase().includes(term) ||
        a.tagId.toLowerCase().includes(term) ||
        categoryName.includes(term) ||
        a.description.toLowerCase().includes(term)
      );
    });
  }, [assets, searchTerm, categories]);

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredAssets.length) setSelectedIds([]);
    else setSelectedIds(filteredAssets.map((a: any) => a.id));
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleScrapAction = () => {
    onBulkScrap(selectedIds, scrapDate);
    setSelectedIds([]);
    setShowScrapPicker(false);
  };

  const handleMoveAction = () => {
    onBulkMove(selectedIds, moveBranchId, moveLocId, moveSubLocId);
    setSelectedIds([]);
    setShowMovePicker(false);
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative w-full md:w-96">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Search size={18} className="text-slate-400" />
          </div>
          <input type="text" placeholder="Search registry..." className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-10 py-2.5 text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-100 transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}/>
        </div>
        <button onClick={onDeleteAll} className="text-red-400 hover:text-red-600 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg flex items-center gap-2"><AlertTriangle size={14}/> Purge</button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-24">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 font-black uppercase text-[10px] tracking-widest border-b border-slate-200">
            <tr>
              <th className="px-6 py-5 text-left w-10"><button onClick={toggleSelectAll}>{selectedIds.length === filteredAssets.length && filteredAssets.length > 0 ? <CheckSquare size={18} /> : <Square size={18} />}</button></th>
              <th className="px-6 py-5 text-left">Asset Reference</th>
              <th className="px-6 py-5 text-left">Description</th>
              <th className="px-6 py-5 text-left">Location</th>
              <th className="px-6 py-5 text-right">NBV</th>
              <th className="px-6 py-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredAssets.map((a: Asset) => {
              const branch = locations.find((l: any) => l.id === a.branchId);
              const isSelected = selectedIds.includes(a.id);
              return (
                <tr key={a.id} className={`hover:bg-blue-50/30 transition-colors ${isSelected ? 'bg-blue-50/50' : ''} ${a.status === AssetStatus.SCRAPPED ? 'opacity-60' : ''}`}>
                  <td className="px-6 py-4"><button onClick={() => toggleSelectOne(a.id)} className={isSelected ? 'text-blue-600' : 'text-slate-300'}>{isSelected ? <CheckSquare size={18} /> : <Square size={18} />}</button></td>
                  <td className="px-6 py-4">
                    <span className="font-black text-blue-600 tracking-tighter">{a.assetNumber}</span>
                    {a.status === AssetStatus.SCRAPPED && <span className="ml-2 bg-red-100 text-red-600 px-1.5 py-0.5 rounded text-[8px] font-black uppercase">SCRAPPED</span>}
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-bold text-slate-800 block text-xs">{a.name}</span>
                    <span className="text-[10px] text-slate-400">{a.description || 'No description'}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">{branch?.name || 'Unassigned'}</span>
                  </td>
                  <td className="px-6 py-4 text-right font-black text-slate-700 font-mono text-xs">
                    {currencyFormatter.format(a.components.reduce((s,c) => s + (c.status === AssetStatus.ACTIVE ? c.cost : 0), 0))}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => onEdit(a)} className="bg-slate-100 text-slate-600 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white">View</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedIds.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-8 py-5 rounded-3xl shadow-2xl flex flex-col items-center gap-4 border border-slate-800 z-50 animate-in slide-in-from-bottom-8">
           <div className="flex items-center gap-8">
             <div className="flex flex-col">
               <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Selected Assets</span>
               <span className="text-xl font-black tracking-tighter">{selectedIds.length} Records</span>
             </div>
             <div className="h-10 w-[1px] bg-slate-800"></div>
             <div className="flex gap-2">
               <button onClick={() => setShowMovePicker(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><MapPin size={16}/> Relocate</button>
               <button onClick={() => setShowScrapPicker(true)} className="bg-orange-600 hover:bg-orange-700 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><Hammer size={16}/> Scrap Batch</button>
               <button onClick={() => onBulkDelete(selectedIds)} className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><Trash2 size={16}/> Delete</button>
               <button onClick={() => setSelectedIds([])} className="text-slate-400 hover:text-white px-4 py-2 text-[10px] font-black uppercase tracking-widest">Cancel</button>
             </div>
           </div>

           {showScrapPicker && (
             <div className="bg-slate-800 p-4 rounded-2xl w-full flex items-center justify-between gap-4 border border-slate-700 animate-in zoom-in-95">
                <div className="flex flex-col">
                  <span className="text-[9px] font-black uppercase text-orange-400">Scrap Date Allocation</span>
                  <input type="date" value={scrapDate} onChange={(e) => setScrapDate(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-bold mt-1 outline-none"/>
                </div>
                <button onClick={handleScrapAction} className="bg-orange-500 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest">Confirm Batch Scrap</button>
             </div>
           )}

           {showMovePicker && (
             <div className="bg-slate-800 p-6 rounded-2xl w-full space-y-4 border border-slate-700 animate-in zoom-in-95">
                <span className="text-[9px] font-black uppercase text-blue-400 block mb-2">Relocate Batch to Functional Hierarchy</span>
                <div className="grid grid-cols-3 gap-3">
                  <select className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-[10px] font-bold text-white outline-none" value={moveBranchId} onChange={(e) => setMoveBranchId(e.target.value)}>
                    <option value="">Select Branch</option>
                    {locations.filter((l: any) => l.type === 'Branch').map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                  <select className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-[10px] font-bold text-white outline-none" value={moveLocId} onChange={(e) => setMoveLocId(e.target.value)}>
                    <option value="">Functional Location</option>
                    {locations.filter((l: any) => l.type === 'Location' && l.parentId === moveBranchId).map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                  <select className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-[10px] font-bold text-white outline-none" value={moveSubLocId} onChange={(e) => setMoveSubLocId(e.target.value)}>
                    <option value="">Sub-Location</option>
                    {locations.filter((l: any) => l.type === 'Sublocation' && l.parentId === moveLocId).map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
                <button onClick={handleMoveAction} className="w-full bg-blue-500 text-white py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest">Execute Batch Move</button>
             </div>
           )}
        </div>
      )}
    </div>
  );
};

export default App;