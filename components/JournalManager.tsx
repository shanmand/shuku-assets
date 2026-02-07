
import React, { useMemo, useState } from 'react';
import { Asset, JournalEntry, AssetCategory, AssetLocation } from '../types';
import { calculateDepreciation } from '../services/assetService';
import { format, endOfMonth } from 'date-fns';
import { BookText, Download, Calculator, Filter } from 'lucide-react';
import * as XLSX from 'xlsx';

// Custom implementation of startOfMonth as it is missing from date-fns export in this environment
const startOfMonth = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth(), 1);
};

interface JournalManagerProps {
  assets: Asset[];
  categories: AssetCategory[];
  locations: AssetLocation[];
  selectedMonth: string; // YYYY-MM
}

const JournalManager: React.FC<JournalManagerProps> = ({ assets, categories, locations, selectedMonth }) => {
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  
  const branches = useMemo(() => locations.filter(u => u.type === 'Branch'), [locations]);

  const filteredAssets = useMemo(() => {
    if (selectedBranch === 'all') return assets;
    return assets.filter(a => a.branchId === selectedBranch);
  }, [assets, selectedBranch]);

  const journals = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    if (!year || !month) return [];
    
    const start = startOfMonth(new Date(year, month - 1));
    const end = endOfMonth(new Date(year, month - 1));
    const entries: JournalEntry[] = [];

    filteredAssets.forEach(asset => {
      const calc = calculateDepreciation(asset, start, end, categories);
      const category = categories.find(c => c.id === asset.categoryId);
      if (!category) return;

      if (calc.periodicDepr > 0) {
        entries.push({
          id: `depr-${asset.id}`,
          date: format(end, 'yyyy-MM-dd'),
          accountName: `Depr Expense: ${category.name}`,
          accountCode: category.glCodeDeprExpense,
          description: `Daily Depr Charge - ${asset.assetNumber} (${selectedMonth})`,
          debit: calc.periodicDepr,
          credit: 0,
          branchId: asset.branchId
        });
        entries.push({
          id: `accum-${asset.id}`,
          date: format(end, 'yyyy-MM-dd'),
          accountName: `Accum Depr: ${category.name}`,
          accountCode: category.glCodeAccumDepr,
          description: `Daily Depr Charge - ${asset.assetNumber} (${selectedMonth})`,
          debit: 0,
          credit: calc.periodicDepr,
          branchId: asset.branchId
        });
      }

      if (calc.additions > 0) {
        entries.push({
          id: `add-${asset.id}`,
          date: format(end, 'yyyy-MM-dd'),
          accountName: `Asset Cost: ${category.name}`,
          accountCode: category.glCodeCost,
          description: `Acquisition - ${asset.assetNumber}`,
          debit: calc.additions,
          credit: 0,
          branchId: asset.branchId
        });
        entries.push({
          id: `pay-${asset.id}`,
          date: format(end, 'yyyy-MM-dd'),
          accountName: `Accounts Payable / Bank`,
          accountCode: '2000/001',
          description: `Acquisition - ${asset.assetNumber}`,
          debit: 0,
          credit: calc.additions,
          branchId: asset.branchId
        });
      }
    });

    return entries;
  }, [filteredAssets, categories, selectedMonth]);

  const exportJournals = () => {
    const ws = XLSX.utils.json_to_sheet(journals.map(j => ({
      Date: j.date,
      'Account Code': j.accountCode,
      'Account Name': j.accountName,
      Description: j.description,
      Branch: locations.find(o => o.id === j.branchId)?.name || 'Unknown',
      Debit: j.debit.toFixed(2),
      Credit: j.credit.toFixed(2)
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "GL Journals");
    XLSX.writeFile(wb, `Journals_${selectedMonth}_${selectedBranch === 'all' ? 'CONSOLIDATED' : 'BRANCH'}.xlsx`);
  };

  const currencyFormatter = new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6 no-print">
        <div className="flex items-center gap-6">
          <div className="bg-blue-50 p-3 rounded-xl text-blue-600">
            <BookText size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">General Ledger Journals</h2>
            <p className="text-xs text-slate-500 font-medium">Automated IFRS movements for period: {selectedMonth}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200">
            <Filter size={14} className="text-slate-400" />
            <select 
              className="bg-transparent text-[10px] font-black uppercase tracking-widest outline-none cursor-pointer pr-4"
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
            >
              <option value="all">CONSOLIDATED</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name.toUpperCase()}</option>
              ))}
            </select>
          </div>
          <button 
            onClick={exportJournals}
            className="bg-[#1e3a5f] text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-blue-900 transition-all shadow-lg shadow-blue-100"
          >
            <Download size={16} /> Export
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-black uppercase text-[9px] tracking-widest">
              <tr>
                <th className="px-6 py-5 text-left">Date</th>
                <th className="px-6 py-5 text-left">Account</th>
                <th className="px-6 py-5 text-left">Reference / Description</th>
                {selectedBranch === 'all' && <th className="px-6 py-5 text-left">Branch</th>}
                <th className="px-6 py-5 text-right">Debit</th>
                <th className="px-6 py-5 text-right">Credit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {journals.length === 0 ? (
                <tr>
                  <td colSpan={selectedBranch === 'all' ? 6 : 5} className="px-6 py-24 text-center">
                    <div className="flex flex-col items-center gap-4 text-slate-300">
                      <Calculator size={64} strokeWidth={1} />
                      <p className="font-black uppercase tracking-widest text-[10px]">No journal activity for selected criteria</p>
                    </div>
                  </td>
                </tr>
              ) : (
                journals.map((j, i) => (
                  <tr key={`${j.id}-${i}`} className="hover:bg-blue-50/30 transition-colors group">
                    <td className="px-6 py-4 font-mono text-slate-500 text-[11px]">{j.date}</td>
                    <td className="px-6 py-4">
                      <span className="font-black text-slate-800 block text-[12px]">{j.accountCode}</span>
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">{j.accountName}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-slate-600 font-medium text-[11px] line-clamp-1">{j.description}</span>
                    </td>
                    {selectedBranch === 'all' && (
                      <td className="px-6 py-4">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded">
                          {locations.find(o => o.id === j.branchId)?.name || 'Unknown'}
                        </span>
                      </td>
                    )}
                    <td className="px-6 py-4 text-right">
                      {j.debit > 0 && (
                        <span className="font-mono font-black text-emerald-600 text-sm">
                          {currencyFormatter.format(j.debit)}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {j.credit > 0 && (
                        <span className="font-mono font-black text-red-600 text-sm">
                          {currencyFormatter.format(j.credit)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {journals.length > 0 && (
              <tfoot className="bg-slate-900 text-white font-black text-[11px] uppercase tracking-widest">
                <tr>
                  <td colSpan={selectedBranch === 'all' ? 4 : 3} className="px-6 py-4 text-right">Trial Balance Totals</td>
                  <td className="px-6 py-4 text-right font-mono">
                    {currencyFormatter.format(journals.reduce((sum, j) => sum + j.debit, 0))}
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-emerald-400">
                    {currencyFormatter.format(journals.reduce((sum, j) => sum + j.credit, 0))}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};

export default JournalManager;
