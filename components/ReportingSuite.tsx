import React, { useMemo, useState } from 'react';
import { Asset, AssetCategory, AssetLocation } from '../types';
import { calculateDepreciation } from '../services/assetService';
import { isValid, isBefore, format } from 'date-fns';
import { Printer, FileSpreadsheet, FileBarChart, ReceiptText, FileText, Download, FileDown } from 'lucide-react';
import { ORGANIZATIONAL_UNITS } from '../constants';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface ReportingSuiteProps {
  assets: Asset[];
  categories: AssetCategory[];
  locations: AssetLocation[];
  startDate: string;
  endDate: string;
}

const ReportingSuite: React.FC<ReportingSuiteProps> = ({ assets, categories, locations, startDate, endDate }) => {
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [activeView, setActiveView] = useState<'ifrs' | 'sars'>('ifrs');
  
  const branches = useMemo(() => locations.filter(u => u.type === 'Branch'), [locations]);

  const currencyFormatter = new Intl.NumberFormat('en-ZA', { 
    style: 'currency', 
    currency: 'ZAR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  const getAcqDate = (asset: Asset) => {
    if (!asset.components || asset.components.length === 0) return 'N/A';
    const sorted = [...asset.components].sort((a, b) => new Date(a.acquisitionDate).getTime() - new Date(b.acquisitionDate).getTime());
    return sorted[0].acquisitionDate;
  };

  const filteredAssets = useMemo(() => {
    if (selectedBranch === 'all') return assets;
    return assets.filter(a => a.branchId === selectedBranch);
  }, [assets, selectedBranch]);

  const calculations = useMemo(() => {
    let start = new Date(startDate);
    let end = new Date(endDate);
    
    if (!isValid(start)) start = new Date(new Date().getFullYear(), 0, 1);
    if (!isValid(end)) end = new Date();

    return filteredAssets.map(a => {
      const calc = calculateDepreciation(a, start, end, categories);
      return { ...calc, assetId: a.id };
    });
  }, [filteredAssets, startDate, endDate, categories]);

  // Determine if we should show the Revaluation/Impairment column
  const hasRevImp = useMemo(() => {
    return calculations.some(c => (c.revaluations || 0) !== 0 || (c.impairments || 0) !== 0);
  }, [calculations]);

  const groupedCalculations = useMemo(() => {
    const groups: Record<string, typeof calculations> = {};
    calculations.forEach(c => {
      const asset = assets.find(a => a.id === c.assetId)!;
      
      // EXCLUSION LOGIC: 
      // Do not show assets that had no cost basis at the start AND no additions in the period.
      if ((c.openingCost || 0) === 0 && (c.additions || 0) === 0 && (c.closingCost || 0) === 0) {
        return;
      }

      if (!groups[asset.categoryId]) groups[asset.categoryId] = [];
      groups[asset.categoryId].push(c);
    });

    // Sort within each group by acquisition date
    Object.keys(groups).forEach(catId => {
      groups[catId].sort((a, b) => {
        const assetA = assets.find(as => as.id === a.assetId)!;
        const assetB = assets.find(as => as.id === b.assetId)!;
        return getAcqDate(assetA).localeCompare(getAcqDate(assetB));
      });
    });

    return groups;
  }, [calculations, assets]);

  // Use this for exports to ensure they match the filtered screen view
  const visibleCalculations = useMemo(() => {
    return Object.values(groupedCalculations).flat();
  }, [groupedCalculations]);

  const exportToExcel = () => {
    const reportData = visibleCalculations.map(calc => {
      const asset = assets.find(a => a.id === calc.assetId)!;
      const cat = categories.find(c => c.id === asset.categoryId);
      const row: any = {
        'Asset Number': asset.assetNumber,
        'Asset Name': asset.name,
        'Electronic Tag / RFID': asset.tagId || 'N/A',
        'Acq Date': getAcqDate(asset),
        'Category': cat?.name || '',
        'Opening Cost': calc.openingCost,
        'Additions': calc.additions,
      };

      if (hasRevImp) {
        row['Revaluations/Impairments'] = (calc.revaluations || 0) - (calc.impairments || 0);
      }

      row['Disposals'] = calc.disposals;
      row['Closing Cost'] = calc.closingCost;
      
      if (activeView === 'ifrs') {
        row['Accum Depr Opening'] = calc.openingAccumulatedDepr;
        row['Depr Charge'] = calc.periodicDepr;
        row['Accum Depr Closing'] = calc.closingAccumulatedDepr;
        row['Net Book Value'] = calc.nbv;
      } else {
        row['Accum Wear & Tear Opening'] = calc.openingAccumulatedTaxDepr;
        row['Wear & Tear Charge'] = calc.taxDeductionForPeriod;
        row['Accum Wear & Tear Closing'] = calc.closingAccumulatedTaxDepr;
        row['Tax Value'] = calc.taxValue;
      }
      
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(reportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, activeView.toUpperCase() + " Schedule");
    XLSX.writeFile(wb, `Lupo_Bakery_Asset_Report_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    const title = activeView === 'ifrs' ? 'Asset Movement Schedule (IAS 16)' : 'SARS Wear & Tear Schedule';
    const primaryColor = activeView === 'ifrs' ? [30, 58, 95] : [5, 150, 105];
    const term = activeView === 'ifrs' ? 'Depr' : 'W&T';

    doc.setFontSize(18);
    doc.setTextColor(40, 40, 40);
    doc.text("SHUKU ASSET MANAGEMENT", 14, 15);
    doc.setFontSize(10);
    doc.text(`Entity: Lupo Bakery Pty Ltd • Period: ${startDate} to ${endDate}`, 14, 22);
    doc.setFontSize(14);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(title.toUpperCase(), 14, 32);

    const tableRows: any[] = [];
    const totalCols = hasRevImp ? 12 : 11;

    Object.keys(groupedCalculations).forEach(catId => {
      const category = categories.find(c => c.id === catId);
      const items = groupedCalculations[catId];
      tableRows.push([{ content: `CLASS: ${category?.name || 'Unknown'}`, colSpan: totalCols, styles: { fillColor: [240, 240, 240], fontStyle: 'bold' } }]);
      
      items.forEach(calc => {
        const asset = assets.find(a => a.id === calc.assetId)!;
        const revalImpDelta = (calc.revaluations || 0) - (calc.impairments || 0);
        
        const row: any[] = [
          { content: `${asset.name}\n(${asset.assetNumber})`, styles: { fontStyle: 'bold' } },
          asset.tagId || '-',
          getAcqDate(asset),
          currencyFormatter.format(calc.openingCost),
          currencyFormatter.format(calc.additions),
        ];

        if (hasRevImp) row.push(revalImpDelta === 0 ? '-' : currencyFormatter.format(revalImpDelta));
        
        row.push(currencyFormatter.format(calc.disposals));
        row.push(currencyFormatter.format(calc.closingCost));
        
        if (activeView === 'ifrs') {
          row.push(currencyFormatter.format(calc.openingAccumulatedDepr));
          row.push(currencyFormatter.format(calc.periodicDepr));
          row.push(currencyFormatter.format(calc.closingAccumulatedDepr));
          row.push({ content: currencyFormatter.format(calc.nbv), styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } });
        } else {
          row.push(currencyFormatter.format(calc.openingAccumulatedTaxDepr));
          row.push(currencyFormatter.format(calc.taxDeductionForPeriod));
          row.push(currencyFormatter.format(calc.closingAccumulatedTaxDepr));
          row.push({ content: currencyFormatter.format(calc.taxValue), styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } });
        }
        
        tableRows.push(row);
      });
    });

    const headerRow = ['Asset Details', 'Tag ID', 'Acq Date', 'Op Bal', 'Additions'];
    if (hasRevImp) headerRow.push('Rev/Imp');
    headerRow.push(...['Disposals', 'Closing Cost', `Op ${term}`, `Charge`, `Cl ${term}`, activeView === 'ifrs' ? 'NBV' : 'Tax Val']);

    autoTable(doc, {
      startY: 38,
      head: [headerRow],
      body: tableRows,
      theme: 'grid',
      styles: { fontSize: 6, cellPadding: 1.5, font: 'helvetica' },
      headStyles: { fillColor: primaryColor as any, textColor: [255, 255, 255], halign: 'center', fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { halign: 'center', cellWidth: 18 },
        2: { halign: 'center', cellWidth: 15 },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' },
        7: { halign: 'right' },
        8: { halign: 'right' },
        9: { halign: 'right' },
        10: { halign: 'right' },
        11: { halign: 'right' }
      }
    });

    doc.save(`Lupo_Asset_Report_${activeView.toUpperCase()}_${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-300 print:bg-white">
      <div className="no-print bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
           <div className="flex items-center gap-6">
             <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner">
               <button onClick={() => setActiveView('ifrs')} className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeView === 'ifrs' ? 'bg-[#1e3a5f] text-white shadow-lg' : 'text-slate-500 hover:text-slate-800'}`}>IFRS Movement</button>
               <button onClick={() => setActiveView('sars')} className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeView === 'sars' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-800'}`}>SARS Schedule</button>
             </div>
             <select className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-xs font-bold text-slate-700 outline-none" value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)}>
                <option value="all">CONSOLIDATED</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name.toUpperCase()}</option>)}
             </select>
           </div>
           <div className="flex gap-2">
             <button onClick={exportToExcel} className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition flex items-center gap-2 border border-slate-200">
               <FileSpreadsheet size={16} className="text-emerald-600" /> Export Excel
             </button>
             <button onClick={exportToPDF} className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition flex items-center gap-2 border border-slate-200">
               <FileDown size={16} className="text-red-600" /> Export PDF
             </button>
             <button onClick={() => window.print()} className="px-5 py-2.5 bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-900 transition flex items-center gap-2 shadow-sm">
               <Printer size={16} /> Print View
             </button>
           </div>
        </div>
      </div>

      <section id="report-content" className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden print:border-none print:shadow-none">
        <div className={`p-8 ${activeView === 'ifrs' ? 'bg-[#1e3a5f]' : 'bg-emerald-800'} text-white flex justify-between items-center`}>
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3">
              {activeView === 'ifrs' ? <FileBarChart size={28} /> : <ReceiptText size={28} />}
              {activeView === 'ifrs' ? 'Asset Movement Schedule (IAS 16)' : 'SARS Wear & Tear Schedule'}
            </h2>
            <p className="text-sm opacity-70">Lupo Bakery Pty Ltd • {startDate} to {endDate}</p>
          </div>
          <div className="text-right no-print">
            <p className="text-[10px] font-black uppercase opacity-60 tracking-widest">Reporting Basis</p>
            <p className="text-xs font-bold">{activeView === 'ifrs' ? 'International Financial Reporting Standards' : 'South African Revenue Service'}</p>
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-[10px] text-left border-collapse">
            <thead className="bg-slate-50 text-slate-500 font-black text-[8px] uppercase border-b border-slate-200">
              {/* Grouped Header Row */}
              <tr className="divide-x divide-slate-200">
                <th colSpan={2} className="px-4 py-2 border-b border-slate-200"></th>
                <th colSpan={hasRevImp ? 6 : 5} className="px-2 py-2 text-center bg-slate-100 border-b border-slate-200">Cost Analysis</th>
                <th colSpan={3} className="px-2 py-2 text-center bg-slate-200/50 border-b border-slate-200">
                  {activeView === 'ifrs' ? 'Accumulated Depreciation' : 'Accumulated Wear & Tear'}
                </th>
                <th className="px-4 py-2 border-b border-slate-200"></th>
              </tr>
              {/* Column Specific Row */}
              <tr className="divide-x divide-slate-200">
                <th className="px-4 py-4 sticky left-0 z-10 bg-white">Asset Details</th>
                <th className="px-2 py-4 text-center">Electronic Tag / RFID</th>
                <th className="px-2 py-4 text-center">Acq Date</th>
                <th className="px-2 py-4 text-center">Op Bal</th>
                <th className="px-2 py-4 text-center">Additions</th>
                {hasRevImp && <th className="px-2 py-4 text-center">Rev / Imp</th>}
                <th className="px-2 py-4 text-center">Disposals</th>
                <th className="px-2 py-4 text-center">Closing Cost</th>
                <th className="px-2 py-4 text-center">Opening</th>
                <th className="px-2 py-4 text-center">Charge</th>
                <th className="px-2 py-4 text-center">Closing</th>
                <th className="px-4 py-4 text-right bg-slate-900 text-white min-w-[120px]">
                  {activeView === 'ifrs' ? 'Net Book Value' : 'Tax Value'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {Object.keys(groupedCalculations).length === 0 ? (
                <tr><td colSpan={hasRevImp ? 13 : 12} className="px-4 py-24 text-center text-slate-300 font-bold uppercase tracking-widest">No assets matching criteria</td></tr>
              ) : (
                Object.keys(groupedCalculations).map(catId => {
                  const category = categories.find(c => c.id === catId);
                  const items = groupedCalculations[catId];
                  const isSars = activeView === 'sars';

                  // Calculate totals for this group
                  const groupTotal = items.reduce((acc, curr) => ({
                    openingCost: acc.openingCost + curr.openingCost,
                    additions: acc.additions + curr.additions,
                    revalImp: acc.revalImp + (curr.revaluations || 0) - (curr.impairments || 0),
                    disposals: acc.disposals + curr.disposals,
                    closingCost: acc.closingCost + curr.closingCost,
                    openingDepr: acc.openingDepr + (isSars ? curr.openingAccumulatedTaxDepr : curr.openingAccumulatedDepr),
                    periodicDepr: acc.periodicDepr + (isSars ? curr.taxDeductionForPeriod : curr.periodicDepr),
                    closingDepr: acc.closingDepr + (isSars ? curr.closingAccumulatedTaxDepr : curr.closingAccumulatedDepr),
                    carryingValue: acc.carryingValue + (isSars ? curr.taxValue : curr.nbv)
                  }), {
                    openingCost: 0, additions: 0, revalImp: 0, disposals: 0, closingCost: 0,
                    openingDepr: 0, periodicDepr: 0, closingDepr: 0, carryingValue: 0
                  });

                  return (
                    <React.Fragment key={catId}>
                      <tr className="bg-slate-50"><td colSpan={hasRevImp ? 13 : 12} className="px-4 py-2 font-black text-[9px] text-slate-400 uppercase tracking-widest border-l-4 border-blue-500">Class: {category?.name}</td></tr>
                      {items.map(calc => {
                        const asset = assets.find(a => a.id === calc.assetId)!;
                        const revalImpDelta = (calc.revaluations || 0) - (calc.impairments || 0);
                        
                        return (
                          <tr key={calc.assetId} className="hover:bg-slate-50 divide-x divide-slate-100 transition-colors">
                            <td className="px-4 py-3 sticky left-0 z-10 bg-white font-bold text-slate-800">
                              <span className="block truncate max-w-[150px]">{asset.name}</span>
                              <span className="block text-[8px] text-slate-400 font-mono tracking-tighter">{asset.assetNumber}</span>
                            </td>
                            <td className="px-2 py-3 text-center text-[9px] font-bold text-slate-500 uppercase tracking-tight">
                              {asset.tagId || '-'}
                            </td>
                            <td className="px-2 py-3 text-center font-mono text-slate-500">
                              {getAcqDate(asset)}
                            </td>
                            <td className="px-2 py-3 text-right font-mono">{currencyFormatter.format(calc.openingCost)}</td>
                            <td className="px-2 py-3 text-right text-emerald-600 font-mono">+{currencyFormatter.format(calc.additions)}</td>
                            {hasRevImp && (
                              <td className={`px-2 py-3 text-right font-mono ${revalImpDelta >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                                {revalImpDelta === 0 ? '-' : currencyFormatter.format(revalImpDelta)}
                              </td>
                            )}
                            <td className="px-2 py-3 text-right text-red-600 font-mono">-{currencyFormatter.format(calc.disposals)}</td>
                            <td className="px-2 py-3 text-right font-black font-mono">{currencyFormatter.format(calc.closingCost)}</td>
                            
                            <td className="px-2 py-3 text-right text-slate-400 font-mono">
                               {currencyFormatter.format(isSars ? calc.openingAccumulatedTaxDepr : calc.openingAccumulatedDepr)}
                            </td>
                            <td className="px-2 py-3 text-right text-blue-600 font-mono">
                               {currencyFormatter.format(isSars ? calc.taxDeductionForPeriod : calc.periodicDepr)}
                            </td>
                            <td className="px-2 py-3 text-right font-black font-mono">
                               {currencyFormatter.format(isSars ? calc.closingAccumulatedTaxDepr : calc.closingAccumulatedDepr)}
                            </td>
                            
                            <td className="px-4 py-3 text-right bg-slate-900/5 text-slate-900 font-black font-mono border-l-2 border-slate-900/10">
                              {currencyFormatter.format(isSars ? calc.taxValue : calc.nbv)}
                            </td>
                          </tr>
                        );
                      })}
                      {/* Subtotal Row */}
                      <tr className="bg-slate-100/50 font-black divide-x divide-slate-200">
                        <td colSpan={3} className="px-4 py-3 text-right uppercase tracking-widest text-[8px] text-slate-500">Subtotal: {category?.name}</td>
                        <td className="px-2 py-3 text-right font-mono">{currencyFormatter.format(groupTotal.openingCost)}</td>
                        <td className="px-2 py-3 text-right font-mono text-emerald-600">{currencyFormatter.format(groupTotal.additions)}</td>
                        {hasRevImp && (
                          <td className={`px-2 py-3 text-right font-mono ${groupTotal.revalImp >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                            {groupTotal.revalImp === 0 ? '-' : currencyFormatter.format(groupTotal.revalImp)}
                          </td>
                        )}
                        <td className="px-2 py-3 text-right font-mono text-red-600">{currencyFormatter.format(groupTotal.disposals)}</td>
                        <td className="px-2 py-3 text-right font-mono">{currencyFormatter.format(groupTotal.closingCost)}</td>
                        <td className="px-2 py-3 text-right font-mono text-slate-500">{currencyFormatter.format(groupTotal.openingDepr)}</td>
                        <td className="px-2 py-3 text-right font-mono text-blue-600">{currencyFormatter.format(groupTotal.periodicDepr)}</td>
                        <td className="px-2 py-3 text-right font-mono">{currencyFormatter.format(groupTotal.closingDepr)}</td>
                        <td className="px-4 py-3 text-right bg-slate-200/50 font-mono">{currencyFormatter.format(groupTotal.carryingValue)}</td>
                      </tr>
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default ReportingSuite;