
import React, { useState, useEffect, useMemo } from 'react';
import { Asset, AssetStatus, AssetComponent, AssetLocation, AssetCategory, TaxStrategy } from '../types';
import { Tag, Plus, Trash2, Box, MapPin, XCircle, CheckCircle, AlertTriangle, Hammer, Ban, Truck, Receipt, Phone, ShieldCheck, Calendar, Wallet, FileText, Info } from 'lucide-react';

interface AssetFormProps {
  asset?: Asset;
  onSave: (asset: Asset) => void;
  onCancel: () => void;
  existingAssets: Asset[];
  categories: AssetCategory[];
  locations: AssetLocation[];
}

const AssetForm: React.FC<AssetFormProps> = ({ asset, onSave, onCancel, existingAssets, categories, locations }) => {
  const [formData, setFormData] = useState<Partial<Asset>>({
    assetNumber: '',
    tagId: '',
    name: '',
    description: '',
    categoryId: categories[0]?.id || '',
    branchId: locations.filter(u => u.type === 'Branch')[0]?.id || '',
    locationId: '',
    subLocationId: '',
    status: AssetStatus.ACTIVE,
    components: [],
  });

  const branches = useMemo(() => locations.filter(u => u.type === 'Branch'), [locations]);
  
  // Filter functional locations based on selected branch
  const filteredFunctionalLocations = useMemo(() => {
    return locations.filter(l => l.type === 'Location' && l.parentId === formData.branchId);
  }, [locations, formData.branchId]);

  // Filter sub-locations based on selected functional location
  const filteredSubLocations = useMemo(() => {
    return locations.filter(l => l.type === 'Sublocation' && l.parentId === formData.locationId);
  }, [locations, formData.locationId]);
  
  const isDuplicate = useMemo(() => {
    if (!formData.assetNumber) return false;
    return existingAssets.some(a => a.assetNumber === formData.assetNumber && a.id !== asset?.id);
  }, [formData.assetNumber, existingAssets, asset]);

  useEffect(() => {
    if (asset && asset.id) {
      setFormData(asset);
    } else {
      const cat = categories[0];
      if (cat) {
        const initialComponent: AssetComponent = {
          id: 'primary',
          name: 'Primary Unit',
          acquisitionDate: new Date().toISOString().split('T')[0],
          cost: 0,
          residualValue: 0,
          usefulLifeYears: cat.defaultUsefulLife,
          taxRate: cat.defaultTaxRate,
          status: AssetStatus.ACTIVE,
          supplierName: '',
          supplierContact: '',
          invoiceNumber: ''
        };
        setFormData(prev => ({ ...prev, components: [initialComponent] }));
      }
    }
  }, [asset, categories]);

  const handleCategoryChange = (catId: string) => {
    const category = categories.find(c => c.id === catId);
    if (category) {
      setFormData(prev => ({
        ...prev,
        categoryId: catId,
        components: prev.components?.map(c => ({
          ...c,
          usefulLifeYears: category.defaultUsefulLife,
          taxRate: category.defaultTaxRate,
          residualValue: (c.cost * category.residualPercentage) / 100
        }))
      }));
    }
  };

  const addComponent = () => {
    const category = categories.find(c => c.id === formData.categoryId);
    const newComp: AssetComponent = {
      id: Math.random().toString(36).substr(2, 9),
      name: 'New Component',
      acquisitionDate: new Date().toISOString().split('T')[0],
      cost: 0,
      residualValue: 0,
      usefulLifeYears: category?.defaultUsefulLife || 5,
      taxRate: category?.defaultTaxRate || 20,
      status: AssetStatus.ACTIVE,
      supplierName: '',
      supplierContact: '',
      invoiceNumber: ''
    };
    setFormData(prev => ({ ...prev, components: [...(prev.components || []), newComp] }));
  };

  const updateComponent = (id: string, updates: Partial<AssetComponent>) => {
    setFormData(prev => {
      const updatedComponents = prev.components?.map(c => {
        if (c.id === id) {
          const newComp = { ...c, ...updates };
          if (updates.cost !== undefined) {
             const category = categories.find(cat => cat.id === prev.categoryId);
             if (category) {
               newComp.residualValue = (updates.cost * category.residualPercentage) / 100;
             }
          }
          return newComp;
        }
        return c;
      });
      return { ...prev, components: updatedComponents };
    });
  };

  const removeComponent = (id: string) => {
    setFormData(prev => ({
      ...prev,
      components: prev.components?.filter(c => c.id !== id)
    }));
  };

  const toggleDisposal = (id: string) => {
    const comp = formData.components?.find(c => c.id === id);
    if (!comp) return;

    if (comp.status === AssetStatus.ACTIVE) {
      updateComponent(id, { 
        status: AssetStatus.DISPOSED, 
        disposalDate: new Date().toISOString().split('T')[0],
        disposalProceeds: 0 
      });
    } else {
      updateComponent(id, { 
        status: AssetStatus.ACTIVE, 
        disposalDate: undefined,
        disposalProceeds: undefined 
      });
    }
  };

  const bulkAction = (type: 'DISPOSE' | 'SCRAP') => {
    const date = new Date().toISOString().split('T')[0];
    const newComponents = formData.components?.map(c => ({
      ...c,
      status: type === 'DISPOSE' ? AssetStatus.DISPOSED : AssetStatus.SCRAPPED,
      disposalDate: date,
      disposalProceeds: type === 'SCRAP' ? 0 : (c.disposalProceeds || 0)
    }));
    setFormData(p => ({ ...p, components: newComponents, status: type === 'DISPOSE' ? AssetStatus.DISPOSED : AssetStatus.SCRAPPED }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isDuplicate) return;
    const allRetired = formData.components?.every(c => c.status !== AssetStatus.ACTIVE);
    onSave({
      ...formData as Asset,
      status: allRetired ? AssetStatus.DISPOSED : AssetStatus.ACTIVE,
      id: asset?.id || Math.random().toString(36).substr(2, 9)
    });
  };

  const totalCost = formData.components?.reduce((sum, c) => sum + (c.status === AssetStatus.ACTIVE ? c.cost : 0), 0) || 0;
  const currencyFormatter = new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' });

  return (
    <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-6xl mx-auto border border-slate-200 animate-in zoom-in-95 duration-300">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 pb-6 border-b border-slate-100 gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-lg">
            <Box size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-[#0f172a] uppercase tracking-tighter">
              {asset?.id ? 'Asset Life-cycle Management' : 'Asset Registry Entry'}
            </h2>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1 flex items-center gap-1.5">
              <ShieldCheck size={12} className="text-emerald-500" /> IFRS IAS 16 & SARS Compliant
            </p>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {formData.status === AssetStatus.ACTIVE && asset?.id && (
            <>
              <button type="button" onClick={() => bulkAction('DISPOSE')} className="flex items-center gap-2 bg-orange-50 text-orange-700 border border-orange-200 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-100 transition shadow-sm"><Ban size={14} /> Dispose Asset</button>
              <button type="button" onClick={() => bulkAction('SCRAP')} className="flex items-center gap-2 bg-red-50 text-red-700 border border-red-200 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition shadow-sm"><Hammer size={14} /> Scrap Unit</button>
            </>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
           <div className="lg:col-span-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Asset Reference Number</label>
                  <input type="text" placeholder="e.g. LUP-MAC-001" required className={`w-full border ${isDuplicate ? 'border-red-500 ring-4 ring-red-50' : 'border-slate-200'} rounded-xl px-5 py-3 focus:ring-4 focus:ring-blue-100 outline-none transition-all font-bold text-slate-800 placeholder:text-slate-300`} value={formData.assetNumber || ''} onChange={e => setFormData(p => ({ ...p, assetNumber: e.target.value.toUpperCase() }))} />
                  {isDuplicate && <p className="text-[10px] text-red-500 font-bold mt-1.5 flex items-center gap-1"><AlertTriangle size={12} /> This asset number already exists in the registry.</p>}
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Electronic Tag / RFID</label>
                  <input type="text" placeholder="e.g. 8832-XJ-11" className="w-full border border-slate-200 rounded-xl px-5 py-3 focus:ring-4 focus:ring-blue-100 outline-none transition-all font-mono text-sm placeholder:text-slate-300" value={formData.tagId || ''} onChange={e => setFormData(p => ({ ...p, tagId: e.target.value }))} />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Asset Nomenclature (Name)</label>
                <input type="text" placeholder="e.g. Industrial Dough Mixer Mark IV" required className="w-full border border-slate-200 rounded-xl px-5 py-3 focus:ring-4 focus:ring-blue-100 outline-none transition-all font-black text-lg text-slate-800 placeholder:text-slate-300" value={formData.name || ''} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <FileText size={14} className="text-slate-400" /> Additional Details & Technical Specs
                </label>
                <textarea 
                  rows={4}
                  placeholder="Enter detailed description, model numbers, technical specifications or general notes about this asset..."
                  className="w-full border border-slate-200 rounded-xl px-5 py-4 focus:ring-4 focus:ring-blue-100 outline-none transition-all text-sm font-medium text-slate-700 placeholder:text-slate-300 resize-none"
                  value={formData.description || ''}
                  onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                />
              </div>
           </div>
           
           <div className="lg:col-span-4">
              <div className="bg-slate-50 p-8 rounded-3xl space-y-6 border border-slate-200 shadow-inner sticky top-8">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                  <MapPin size={14} className="text-blue-500" /> Deployment Hierarchy
                </h4>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase tracking-tighter mb-1.5">1. Branch Office</label>
                    <select required className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 outline-none shadow-sm focus:ring-2 focus:ring-blue-500/10" value={formData.branchId || ''} onChange={e => setFormData(p => ({ ...p, branchId: e.target.value, locationId: '', subLocationId: '' }))}>
                      <option value="">-- Choose Branch --</option>
                      {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase tracking-tighter mb-1.5">2. Functional Location</label>
                    <select className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 outline-none shadow-sm focus:ring-2 focus:ring-blue-500/10 disabled:opacity-50" disabled={!formData.branchId} value={formData.locationId || ''} onChange={e => setFormData(p => ({ ...p, locationId: e.target.value, subLocationId: '' }))}>
                      <option value="">-- Choose Location --</option>
                      {filteredFunctionalLocations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase tracking-tighter mb-1.5">3. Specific Spot / Bin</label>
                    <select className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 outline-none shadow-sm focus:ring-2 focus:ring-blue-500/10 disabled:opacity-50" disabled={!formData.locationId} value={formData.subLocationId || ''} onChange={e => setFormData(p => ({ ...p, subLocationId: e.target.value }))}>
                      <option value="">-- Choose Sub-location --</option>
                      {filteredSubLocations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-200">
                  <label className="block text-[9px] font-black text-slate-500 uppercase tracking-tighter mb-1.5">Financial Classification</label>
                  <select required className="w-full bg-blue-50 border border-blue-100 text-blue-900 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-tight outline-none shadow-sm" value={formData.categoryId || ''} onChange={e => handleCategoryChange(e.target.value)}>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
           </div>
        </div>

        <div className="space-y-8">
          <div className="flex justify-between items-center bg-slate-900 p-6 rounded-2xl text-white shadow-xl">
            <div className="flex items-center gap-3">
              <Box size={22} className="text-blue-400" />
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest">IAS 16 Component Registry</h3>
                <p className="text-[10px] text-slate-400 font-bold">Manage individual components or single units</p>
              </div>
            </div>
            {formData.status === AssetStatus.ACTIVE && (
              <button type="button" onClick={addComponent} className="text-[10px] font-black bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all uppercase tracking-widest shadow-lg shadow-blue-900/40 active:scale-95"><Plus size={16} /> Add Component</button>
            )}
          </div>

          <div className="space-y-6">
            {formData.components?.map((comp, idx) => {
              const isRetired = comp.status !== AssetStatus.ACTIVE;
              return (
                <div key={comp.id} className={`relative overflow-hidden border-2 rounded-3xl transition-all shadow-sm ${isRetired ? 'bg-orange-50/50 border-orange-100' : 'bg-white border-slate-100 hover:border-blue-200'}`}>
                  <div className="absolute top-0 left-0 w-2 h-full bg-blue-600/10"></div>
                  <div className="p-8">
                    <div className="flex flex-col xl:flex-row gap-10">
                      {/* Main Component Details */}
                      <div className="flex-grow space-y-6">
                        <div className="flex items-center justify-between mb-4">
                           <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">Component #{idx + 1}</span>
                           <div className="flex gap-2">
                             <button type="button" onClick={() => toggleDisposal(comp.id)} className={`flex items-center gap-2 px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${isRetired ? 'bg-emerald-600 text-white shadow-lg' : 'bg-orange-100 text-orange-600 hover:bg-orange-200'}`}>
                               {isRetired ? <><CheckCircle size={14} /> Restore Unit</> : <><Ban size={14} /> Retire Unit</>}
                             </button>
                             {!isRetired && formData.components!.length > 1 && (<button type="button" onClick={() => removeComponent(comp.id)} className="p-2.5 bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500 rounded-xl transition-all"><Trash2 size={20} /></button>)}
                           </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                          <div className="md:col-span-2">
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Designation</label>
                            <input type="text" placeholder="e.g. Mixing Motor" required disabled={isRetired} className="w-full text-base font-black border-b-2 border-slate-100 focus:border-blue-500 outline-none bg-transparent py-1 transition-all disabled:text-slate-500" value={comp.name} onChange={e => updateComponent(comp.id, { name: e.target.value })} />
                          </div>
                          <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Acquisition</label>
                            <input type="date" required disabled={isRetired} className="w-full text-xs font-bold bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-50" value={comp.acquisitionDate} onChange={e => updateComponent(comp.id, { acquisitionDate: e.target.value })} />
                          </div>
                          <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Unit Cost (R)</label>
                            <input type="number" required disabled={isRetired} className="w-full text-sm font-mono font-black bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-50" value={comp.cost} onChange={e => updateComponent(comp.id, { cost: Number(e.target.value) })} />
                          </div>
                        </div>

                        {/* Supplier Section */}
                        <div className="pt-6 mt-6 border-t border-slate-50 grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div>
                            <label className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5"><Truck size={12} /> Supplier Name</label>
                            <input type="text" placeholder="Bakery Solutions ZAR" disabled={isRetired} className="w-full text-xs font-bold bg-white border border-slate-100 rounded-xl px-4 py-2.5 outline-none focus:border-blue-200 transition-all disabled:opacity-50" value={comp.supplierName || ''} onChange={e => updateComponent(comp.id, { supplierName: e.target.value })} />
                          </div>
                          <div>
                            <label className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5"><Phone size={12} /> Supplier Contact</label>
                            <input type="text" placeholder="+27 12 345 6789" disabled={isRetired} className="w-full text-xs font-bold bg-white border border-slate-100 rounded-xl px-4 py-2.5 outline-none focus:border-blue-200 transition-all disabled:opacity-50" value={comp.supplierContact || ''} onChange={e => updateComponent(comp.id, { supplierContact: e.target.value })} />
                          </div>
                          <div>
                            <label className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5"><Receipt size={12} /> Invoice Ref #</label>
                            <input type="text" placeholder="INV-2024-001" disabled={isRetired} className="w-full text-xs font-mono font-bold bg-white border border-slate-100 rounded-xl px-4 py-2.5 outline-none focus:border-blue-200 transition-all disabled:opacity-50" value={comp.invoiceNumber || ''} onChange={e => updateComponent(comp.id, { invoiceNumber: e.target.value })} />
                          </div>
                        </div>
                      </div>

                      {/* Disposal Analysis Panel */}
                      {isRetired && (
                        <div className="xl:w-80 shrink-0 bg-white p-6 rounded-3xl border-2 border-orange-100 shadow-xl shadow-orange-900/5 animate-in slide-in-from-right-4">
                          <h5 className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                             <AlertTriangle size={14} /> Disposal Event Detail
                          </h5>
                          <div className="space-y-4">
                            <div>
                              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Disposal Date</label>
                              <input 
                                type="date" 
                                required 
                                className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-orange-500/20" 
                                value={comp.disposalDate || ''} 
                                onChange={e => updateComponent(comp.id, { disposalDate: e.target.value })} 
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Proceeds (ZAR)</label>
                              <input 
                                type="number" 
                                required 
                                className="w-full text-sm font-mono font-black bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-orange-500/20" 
                                value={comp.disposalProceeds || 0} 
                                onChange={e => updateComponent(comp.id, { disposalProceeds: Number(e.target.value) })} 
                              />
                            </div>
                            <div className="p-3 bg-orange-50 rounded-xl">
                              <p className="text-[9px] text-orange-700 font-bold flex items-center gap-1.5">
                                <Info size={10} /> SARS Recoupments and IFRS P/L will be auto-calculated.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center pt-10 border-t border-slate-100 gap-8">
          <div className="text-center md:text-left">
            <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Aggregate Carrying Cost</p>
            <h4 className="text-4xl font-black text-[#0f172a] tracking-tighter">{currencyFormatter.format(totalCost)}</h4>
          </div>
          <div className="flex gap-4 w-full md:w-auto">
            <button type="button" onClick={onCancel} className="flex-1 px-8 py-4 text-slate-400 text-xs font-black uppercase tracking-widest hover:text-slate-800 transition-colors">Discard</button>
            <button type="submit" disabled={isDuplicate} className={`flex-1 px-12 py-5 rounded-2xl transition-all shadow-2xl font-black uppercase tracking-widest text-sm ${isDuplicate ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-blue-200 active:scale-95'}`}>
              {asset?.id ? 'Commit Changes' : 'Finalize Registration'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default AssetForm;
