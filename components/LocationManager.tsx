
import React, { useState, useMemo } from 'react';
import { AssetLocation, Asset } from '../types';
import { Map, Plus, Trash2, Landmark, Building2, Box, ChevronRight, AlertCircle, Save } from 'lucide-react';

interface LocationManagerProps {
  locations: AssetLocation[];
  onUpdate: (locations: AssetLocation[]) => void;
  assets: Asset[];
}

const LocationManager: React.FC<LocationManagerProps> = ({ locations, onUpdate, assets }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');

  const branches = useMemo(() => locations.filter(l => l.type === 'Branch'), [locations]);

  const addUnit = (type: 'Branch' | 'Location' | 'Sublocation', parentId?: string) => {
    const newUnit: AssetLocation = {
      id: Math.random().toString(36).substr(2, 9),
      name: `New ${type}`,
      code: `CODE-${Math.floor(Math.random() * 999)}`,
      type,
      parentId
    };
    onUpdate([...locations, newUnit]);
    setEditingId(newUnit.id);
    setNewName(newUnit.name);
    setNewCode(newUnit.code);
  };

  const deleteUnit = (id: string) => {
    // Check if assets are using this location or any child locations
    const childrenIds = locations.filter(l => l.parentId === id).map(l => l.id);
    const subChildrenIds = locations.filter(l => childrenIds.includes(l.parentId || '')).map(l => l.id);
    const allRelatedIds = [id, ...childrenIds, ...subChildrenIds];

    const hasAssets = assets.some(a => 
      allRelatedIds.includes(a.branchId) || 
      allRelatedIds.includes(a.locationId) || 
      allRelatedIds.includes(a.subLocationId)
    );

    if (hasAssets) {
      alert("Cannot delete location: One or more assets are currently assigned to this unit or its children.");
      return;
    }

    if (confirm("Are you sure you want to delete this organizational unit? This action cannot be undone.")) {
      onUpdate(locations.filter(l => !allRelatedIds.includes(l.id)));
    }
  };

  const saveEdit = (id: string) => {
    onUpdate(locations.map(l => l.id === id ? { ...l, name: newName, code: newCode } : l));
    setEditingId(null);
  };

  const startEdit = (unit: AssetLocation) => {
    setEditingId(unit.id);
    setNewName(unit.name);
    setNewCode(unit.code);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Map className="text-blue-600" /> Organizational Infrastructure
          </h2>
          <p className="text-sm text-slate-500 mt-1">Maintain your reporting hierarchy from branches to specific bin locations.</p>
        </div>
        <button 
          onClick={() => addUnit('Branch')}
          className="bg-[#1e3a5f] text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-blue-900 transition-all shadow-md active:scale-95"
        >
          <Plus size={16} /> Add New Branch
        </button>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {branches.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
             <Landmark size={48} className="mx-auto text-slate-200 mb-4" />
             <p className="text-slate-400 font-bold uppercase tracking-widest">No Branches configured</p>
          </div>
        ) : (
          branches.map(branch => (
            <div key={branch.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              <div className="bg-slate-50/50 p-6 border-b border-slate-100 flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="bg-blue-600 text-white p-3 rounded-2xl shadow-lg shadow-blue-200">
                    <Landmark size={24} />
                  </div>
                  {editingId === branch.id ? (
                    <div className="flex gap-2">
                      <input type="text" className="bg-white border border-blue-200 rounded-lg px-3 py-1 font-bold outline-none ring-2 ring-blue-50" value={newName} onChange={e => setNewName(e.target.value)} />
                      <input type="text" className="bg-white border border-blue-200 rounded-lg px-3 py-1 font-mono text-xs outline-none" value={newCode} onChange={e => setNewCode(e.target.value)} />
                      <button onClick={() => saveEdit(branch.id)} className="bg-emerald-600 text-white p-1.5 rounded-lg"><Save size={16} /></button>
                    </div>
                  ) : (
                    <div>
                      <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                        {branch.name}
                        <button onClick={() => startEdit(branch)} className="text-[10px] text-blue-500 font-black hover:underline ml-2">EDIT</button>
                      </h3>
                      <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">Branch Code: {branch.code}</p>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => addUnit('Location', branch.id)}
                    className="text-[10px] font-black uppercase text-blue-600 bg-blue-50 px-4 py-2 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    Add Functional Location
                  </button>
                  <button onClick={() => deleteUnit(branch.id)} className="text-slate-300 hover:text-red-500 transition-colors p-2"><Trash2 size={18} /></button>
                </div>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 bg-white">
                {locations.filter(l => l.parentId === branch.id && l.type === 'Location').map(loc => (
                  <div key={loc.id} className="group relative bg-slate-50 border border-slate-200 rounded-2xl p-5 hover:border-blue-300 transition-all hover:bg-blue-50/30">
                    <div className="flex justify-between items-start mb-4">
                       <div className="flex items-center gap-3">
                         <div className="bg-white p-2 rounded-xl border border-slate-100 text-slate-400 group-hover:text-blue-600 group-hover:scale-110 transition-all">
                           <Building2 size={18} />
                         </div>
                         {editingId === loc.id ? (
                           <div className="space-y-1">
                             <input type="text" className="w-full text-xs font-bold border rounded px-2 py-1" value={newName} onChange={e => setNewName(e.target.value)} />
                             <button onClick={() => saveEdit(loc.id)} className="text-[9px] font-black text-emerald-600">SAVE</button>
                           </div>
                         ) : (
                           <div>
                             <p className="text-sm font-black text-slate-700 uppercase tracking-tight">{loc.name}</p>
                             <p className="text-[9px] font-mono text-slate-400">{loc.code}</p>
                           </div>
                         )}
                       </div>
                       <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                         <button onClick={() => startEdit(loc)} className="text-blue-500 p-1"><ChevronRight size={14} /></button>
                         <button onClick={() => deleteUnit(loc.id)} className="text-slate-300 hover:text-red-500 p-1"><Trash2 size={14} /></button>
                       </div>
                    </div>

                    <div className="space-y-2 mt-2">
                      <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sub-Locations</span>
                        <button onClick={() => addUnit('Sublocation', loc.id)} className="text-[9px] font-black text-blue-600 hover:underline">+ ADD</button>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {locations.filter(l => l.parentId === loc.id && l.type === 'Sublocation').map(sub => (
                          <div key={sub.id} className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 flex items-center gap-2 group/sub shadow-sm hover:shadow transition-shadow">
                            <Box size={12} className="text-slate-400" />
                            {editingId === sub.id ? (
                              <input autoFocus type="text" className="text-[10px] w-20 outline-none" value={newName} onChange={e => setNewName(e.target.value)} onBlur={() => saveEdit(sub.id)} onKeyDown={e => e.key === 'Enter' && saveEdit(sub.id)} />
                            ) : (
                              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tighter" onDoubleClick={() => startEdit(sub)}>{sub.name}</span>
                            )}
                            <button onClick={() => deleteUnit(sub.id)} className="opacity-0 group-hover/sub:opacity-100 transition-opacity text-slate-300 hover:text-red-500"><Trash2 size={10} /></button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
                {locations.filter(l => l.parentId === branch.id && l.type === 'Location').length === 0 && (
                  <div className="col-span-full py-8 text-center text-slate-300">
                    <AlertCircle size={24} className="mx-auto mb-2 opacity-50" />
                    <p className="text-xs font-bold uppercase tracking-widest">No locations defined for this branch</p>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="bg-blue-50 border border-blue-100 p-6 rounded-2xl flex items-start gap-4">
        <AlertCircle className="text-blue-600 shrink-0 mt-0.5" size={20} />
        <div>
          <h4 className="text-xs font-black text-blue-900 uppercase tracking-widest">Infrastructure Note</h4>
          <p className="text-[11px] text-blue-800 font-medium leading-relaxed mt-1">
            Locations and sub-locations are critical for inventory audits and tracking. A unit cannot be deleted if active assets are assigned to it.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LocationManager;
