import React, { useMemo, useState } from 'react';
import { Asset, AssetCategory, AssetLocation, DepreciationCalculation } from '../types';
import { calculateDepreciation } from '../services/assetService';
import { isValid, format } from 'date-fns';
import { Printer, FileSpreadsheet, FileBarChart, ReceiptText, FileDown, CheckSquare, Square, LayoutList, ListTree, Filter } from 'lucide-react';
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
  const [reportMode, setReportMode] = useState<'detailed' | 'summary'>('detailed');
  const [visibleCategoryIds, setVisibleCategoryIds] = useState<string[]>(categories.map(c => c.id));
  
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
    let base = selectedBranch === 'all' ? assets : assets.filter(a => a.branchId === selectedBranch);
    return base.filter(a => visibleCategoryIds.includes(a.categoryId));
  }, [assets, selectedBranch, visibleCategoryIds]);

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

  const hasRevImp = useMemo(() => {
    return calculations.some(c => (c.revaluations || 0) !== 0 || (c.impairments || 0) !== 0);
  }, [calculations]);

  const groupedCalculations = useMemo(() => {
    const groups: Record<string, DepreciationCalculation[]> = {};
    calculations.forEach(c => {
      const asset = assets.find(a => a.id === c.assetId)!;
      if ((c.openingCost || 0) === 0 && (c.additions || 0) === 0 && (c.closingCost || 0) === 0 && (c.disposals || 0) === 0) return;
      if (!groups[asset.categoryId]) groups[asset.categoryId] = [];
      groups[asset.categoryId].push(c);
    });

    Object.keys(groups).forEach(catId => {
      groups[catId].sort((a, b) => {
        const assetA = assets.find(as => as.id === a.assetId)!;
        const assetB = assets.find(as => as.id === b.assetId)!;
        const dateA = new Date(getAcqDate(assetA)).getTime();
        const dateB = new Date(getAcqDate(assetB)).getTime();
        return dateA - dateB;
      });
    });

    return groups;
  }, [calculations, assets]);

  const groupTotals = useMemo(() => {
    const totals: Record<string, any> = {};
    const isSars = activeView === 'sars';

    Object.keys(groupedCalculations).forEach(catId => {
      const items = groupedCalculations[catId] as DepreciationCalculation[];
      // Fix: Add explicit types for acc and curr to avoid unknown property errors
      totals[catId] = items.reduce((acc: any, curr: DepreciationCalculation) => ({
        openingCost: acc.openingCost + curr.openingCost,
        additions: acc.additions + curr.additions,
        revalImp: acc.revalImp + (curr.revaluations || 0) - (curr.impairments || 0),
        disposals: acc.disposals + curr.disposals,
        closingCost: acc.closingCost + curr.closingCost,
        openingDepr: acc.openingDepr + (isSars ? curr.openingAccumulatedTaxDepr : curr.openingAccumulatedDepr),
        periodicDepr: acc.periodicDepr + (isSars ? curr.taxDeductionForPeriod : curr.periodicDepr),
        disposalDepr: acc.disposalDepr + (isSars ? curr.taxDeprOnDisposals : curr.accumulatedDeprOnDisposals),
        closingDepr: acc.closingDepr + (isSars ? curr.closingAccumulatedTaxDepr : curr.closingAccumulatedDepr),
        carryingValue: acc.carryingValue + (isSars ? curr.taxValue : curr.nbv)
      }), {
        openingCost: 0, additions: 0, revalImp: 0, disposals: 0, closingCost: 0,
        openingDepr: 0, periodicDepr: 0, disposalDepr: 0, closingDepr: 0, carryingValue: 0
      });
    });
    return totals;
  }, [groupedCalculations, activeView]);

  const grandTotals = useMemo(() => {
    return Object.values(groupTotals).reduce((acc, curr) => ({
      openingCost: acc.openingCost + curr.openingCost,
      additions: acc.additions + curr.additions,
      revalImp: acc.revalImp + curr.revalImp,
      disposals: acc.disposals + curr.disposals,
      closingCost: acc.closingCost + curr.closingCost,
      openingDepr: acc.openingDepr + curr.openingDepr,
      periodicDepr: acc.periodicDepr + curr.periodicDepr,
      disposalDepr: acc.disposalDepr + curr.disposalDepr,
      closingDepr: acc.closingDepr + curr.closingDepr,
      carryingValue: acc.carryingValue + curr.carryingValue
    }), {
      openingCost: 0, additions: 0, revalImp: 0, disposals: 0, closingCost: 0,
      openingDepr: 0, periodicDepr: 0, disposalDepr: 0, closingDepr: 0, carryingValue: 0
    });
  }, [groupTotals]);

  const exportToExcel = () => {
    const isSars = activeView === 'sars';
    const term = isSars ? 'W&T' : 'Depr';
    
    let data = [];
    if (reportMode === 'summary') {
      data = Object.keys(groupTotals).map(catId => {
        const cat = categories.find(c => c.id === catId);
        const t = groupTotals[catId];
        return {
          'Asset Class': cat?.name,
          'Opening Cost': t.openingCost,
          'Additions': t.additions,
          'Revaluations/Impairments': t.revalImp,
          'Disposals (Cost)': t.disposals,
          'Closing Cost': t.closingCost,
          [`Opening Accum ${term}`]: t.openingDepr,
          [`${term} Charge`]: t.periodicDepr,
          [`${term} on Disposals`]: t.disposalDepr,
          [`Closing Accum ${term}`]: t.closingDepr,
          'Carrying Value': t.carryingValue
        };
      });
    } else {
      // Fix: Cast flat map result to DepreciationCalculation[] to ensure calc properties are accessible
      data = (Object.values(groupedCalculations).flat() as DepreciationCalculation[]).map(calc => {
        const asset = assets.find(a => a.id === calc.assetId)!;
        const cat = categories.find(c => c.id === asset.categoryId);
        return {
          'Asset Number': asset.assetNumber,
          'Asset Name': asset.name,
          'Tag ID': asset.tagId,
          'Acq Date': getAcqDate(asset),
          'Class': cat?.name,
          'Opening Cost': calc.openingCost,
          'Additions': calc.additions,
          'Revaluations/Impairments': (calc.revaluations || 0) - (calc.impairments || 0),
          'Disposals (Cost)': calc.disposals,
          'Closing Cost': calc.closingCost,
          [`Opening Accum ${term}`]: isSars ? calc.openingAccumulatedTaxDepr : calc.openingAccumulatedDepr,
          [`${term} Charge`]: isSars ? calc.taxDeductionForPeriod : calc.periodicDepr,
          [`${term} on Disposals`]: isSars ? calc.taxDeprOnDisposals : calc.accumulatedDeprOnDisposals,
          [`Closing Accum ${term}`]: isSars ? calc.closingAccumulatedTaxDepr : calc.closingAccumulatedDepr,
          'Carrying Value': isSars ? calc.taxValue : calc.nbv
        };
      });
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Asset Report");
    XLSX.writeFile(wb, `Lupo_${activeView.toUpperCase()}_${reportMode}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    const primaryColor = activeView === 'ifrs' ? [30, 58, 95] : [5, 150, 105];
    const isSars = activeView === 'sars';
    
    doc.setFontSize(18); doc.text("SHUKU ASSET MANAGEMENT", 14, 15);
    doc.setFontSize(10); doc.text(`Entity: Lupo Bakery Group • ${reportMode.toUpperCase()} Report • ${startDate} to ${endDate}`, 14, 22);
    doc.setFontSize(14); doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(`${activeView.toUpperCase()} ${reportMode.toUpperCase()} SCHEDULE`, 14, 32);

    const tableRows: any[] = [];
    const headerRow = reportMode === 'summary' 
      ? ['Asset Class', 'Op Cost', 'Additions', 'Rev/Imp', 'Disposals', 'Closing Cost', 'Op Accum', 'Charge', 'Disp Accum', 'Cl Accum', 'VALUE']
      : ['Asset Details', 'Tag ID', 'Acq Date', 'Op Cost', 'Additions', 'Rev/Imp', 'Disposals', 'Closing Cost', 'Op Accum', 'Charge', 'Disp Accum', 'Cl Accum', 'VALUE'];

    const colStyles: any = {};
    if (reportMode === 'detailed') {
      colStyles[0] = { cellWidth: 35 };
      colStyles[1] = { halign: 'center', cellWidth: 15 };
      colStyles[2] = { halign: 'center', cellWidth: 15 };
      for (let i = 3; i <= 12; i++) colStyles[i] = { halign: 'right' };
    } else {
      colStyles[0] = { cellWidth: 45 };
      for (let i = 1; i <= 10; i++) colStyles[i] = { halign: 'right' };
    }

    Object.keys(groupedCalculations).forEach(catId => {
      const cat = categories.find(c => c.id === catId);
      const items = groupedCalculations[catId] as DepreciationCalculation[];
      const t = groupTotals[catId];

      if (reportMode === 'detailed') {
        tableRows.push([{ content: `CLASS: ${cat?.name}`, colSpan: 13, styles: { fillColor: [240, 240, 240], fontStyle: 'bold' } }]);
        items.forEach(calc => {
          const asset = assets.find(a => a.id === calc.assetId)!;
          tableRows.push([
            `${asset.name}\n(${asset.assetNumber})`,
            asset.tagId || '-',
            getAcqDate(asset),
            currencyFormatter.format(calc.openingCost),
            currencyFormatter.format(calc.additions),
            currencyFormatter.format((calc.revaluations || 0) - (calc.impairments || 0)),
            currencyFormatter.format(calc.disposals),
            currencyFormatter.format(calc.closingCost),
            currencyFormatter.format(isSars ? calc.openingAccumulatedTaxDepr : calc.openingAccumulatedDepr),
            currencyFormatter.format(isSars ? calc.taxDeductionForPeriod : calc.periodicDepr),
            currencyFormatter.format(isSars ? calc.taxDeprOnDisposals : calc.accumulatedDeprOnDisposals),
            currencyFormatter.format(isSars ? calc.closingAccumulatedTaxDepr : calc.closingAccumulatedDepr),
            currencyFormatter.format(isSars ? calc.taxValue : calc.nbv)
          ]);
        });
        tableRows.push([
          { content: `Subtotal: ${cat?.name}`, colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } },
          { content: currencyFormatter.format(t.openingCost), styles: { halign: 'right' } },
          { content: currencyFormatter.format(t.additions), styles: { halign: 'right' } },
          { content: currencyFormatter.format(t.revalImp), styles: { halign: 'right' } },
          { content: currencyFormatter.format(t.disposals), styles: { halign: 'right' } },
          { content: currencyFormatter.format(t.closingCost), styles: { halign: 'right' } },
          { content: currencyFormatter.format(t.openingDepr), styles: { halign: 'right' } },
          { content: currencyFormatter.format(t.periodicDepr), styles: { halign: 'right' } },
          { content: currencyFormatter.format(t.disposalDepr), styles: { halign: 'right' } },
          { content: currencyFormatter.format(t.closingDepr), styles: { halign: 'right' } },
          { content: currencyFormatter.format(t.carryingValue), styles: { fontStyle: 'bold', halign: 'right' } }
        ]);
      } else {
        tableRows.push([
          { content: cat?.name, styles: { fontStyle: 'bold' } },
          { content: currencyFormatter.format(t.openingCost), styles: { halign: 'right' } },
          { content: currencyFormatter.format(t.additions), styles: { halign: 'right' } },
          { content: currencyFormatter.format(t.revalImp), styles: { halign: 'right' } },
          { content: currencyFormatter.format(t.disposals), styles: { halign: 'right' } },
          { content: currencyFormatter.format(t.closingCost), styles: { halign: 'right' } },
          { content: currencyFormatter.format(t.openingDepr), styles: { halign: 'right' } },
          { content: currencyFormatter.format(t.periodicDepr), styles: { halign: 'right' } },
          { content: currencyFormatter.format(t.disposalDepr), styles: { halign: 'right' } },
          { content: currencyFormatter.format(t.closingDepr), styles: { halign: 'right' } },
          { content: currencyFormatter.format(t.carryingValue), styles: { fontStyle: 'bold', halign: 'right' } }
        ]);
      }
    });

    const grandRow = [
      { content: 'GRAND TOTAL', colSpan: reportMode === 'summary' ? 1 : 3, styles: { halign: 'right', fontStyle: 'bold', fillColor: [15, 23, 42], textColor: [255, 255, 255] } },
      ...[grandTotals.openingCost, grandTotals.additions, grandTotals.revalImp, grandTotals.disposals, grandTotals.closingCost, grandTotals.openingDepr, grandTotals.periodicDepr, grandTotals.disposalDepr, grandTotals.closingDepr, grandTotals.carryingValue].map(val => ({ content: currencyFormatter.format(val), styles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'right' } }))
    ];
    tableRows.push(grandRow);

    autoTable(doc, {
      startY: 38, head: [headerRow], body: tableRows, theme: 'grid',
      styles: { fontSize: 5.5, cellPadding: 1 },
      headStyles: { fillColor: primaryColor as any, textColor: [255, 255, 255], halign: 'center', fontSize: 6 },
      columnStyles: colStyles
    });

    doc.save(`Lupo_${activeView}_${reportMode}_Report.pdf`);
  };

  const toggleCategory = (id: string) => {
    setVisibleCategoryIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-300">
      <div className="no-print bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col xl:flex-row justify-between items-start gap-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner">
              <button onClick={() => setActiveView('ifrs')} className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeView === 'ifrs' ? 'bg-[#1e3a5f] text-white shadow-lg' : 'text-slate-500 hover:text-slate-800'}`}>IFRS Basis</button>
              <button onClick={() => setActiveView('sars')} className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeView === 'sars' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-800'}`}>SARS Basis</button>
            </div>
            <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner">
              <button onClick={() => setReportMode('detailed')} className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${reportMode === 'detailed' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500'}`}><ListTree size={14}/> Detailed</button>
              <button onClick={() => setReportMode('summary')} className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${reportMode === 'summary' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500'}`}><LayoutList size={14}/> Summary</button>
            </div>
            <select className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-xs font-bold text-slate-700 outline-none" value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)}>
              <option value="all">CONSOLIDATED VIEW</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name.toUpperCase()}</option>)}
            </select>
          </div>
          
          <div className="flex gap-2">
            <button onClick={exportToExcel} className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition flex items-center gap-2 border border-slate-200"><FileSpreadsheet size={16} className="text-emerald-600" /> Excel</button>
            <button onClick={exportToPDF} className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition flex items-center gap-2 border border-slate-200"><FileDown size={16} className="text-red-600" /> PDF</button>
            <button onClick={() => window.print()} className="px-5 py-2.5 bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-900 transition flex items-center gap-2 shadow-sm"><Printer size={16} /> Print</button>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100">
           <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Filter size={12}/> Asset Class Multi-Filter</h4>
           <div className="flex flex-wrap gap-2">
              <button onClick={() => setVisibleCategoryIds(categories.map(c => c.id))} className="text-[9px] font-black uppercase bg-slate-900 text-white px-3 py-1.5 rounded-lg hover:bg-black transition-all">Select All</button>
              <button onClick={() => setVisibleCategoryIds([])} className="text-[9px] font-black uppercase bg-slate-100 text-slate-500 px-3 py-1.5 rounded-lg hover:bg-slate-200 transition-all">Clear All</button>
              {categories.map(cat => {
                const isSelected = visibleCategoryIds.includes(cat.id);
                return (
                  <button key={cat.id} onClick={() => toggleCategory(cat.id)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-tight transition-all border ${isSelected ? 'bg-blue-50 border-blue-200 text-blue-600 shadow-sm' : 'bg-white border-slate-200 text-slate-400 opacity-60'}`}>
                    {isSelected ? <CheckSquare size={12}/> : <Square size={12}/>}
                    {cat.name}
                  </button>
                );
              })}
           </div>
        </div>
      </div>

      <section id="report-content" className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden print:border-none print:shadow-none">
        <div className={`p-8 ${activeView === 'ifrs' ? 'bg-[#1e3a5f]' : 'bg-emerald-800'} text-white flex justify-between items-center`}>
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3">
              {reportMode === 'summary' ? <LayoutList size={28} /> : <FileBarChart size={28} />}
              {activeView === 'ifrs' ? 'IAS 16 Asset Movement' : 'SARS Tax Allowance Schedule'} ({reportMode})
            </h2>
            <p className="text-sm opacity-70">Lupo Bakery Group • {startDate} to {endDate}</p>
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-[10px] text-left border-collapse">
            <thead className="bg-slate-50 text-slate-500 font-black text-[8px] uppercase border-b border-slate-200">
              <tr className="divide-x divide-slate-200">
                <th colSpan={reportMode === 'detailed' ? 3 : 1} className="px-4 py-2 border-b border-slate-200"></th>
                <th colSpan={hasRevImp ? 5 : 4} className="px-2 py-2 text-center bg-slate-100 border-b border-slate-200">Cost Analysis Basis</th>
                <th colSpan={4} className="px-2 py-2 text-center bg-slate-200/50 border-b border-slate-200">
                  {activeView === 'ifrs' ? 'Accumulated Depreciation Movement' : 'Accumulated Tax Wear & Tear'}
                </th>
                <th className="px-4 py-2 border-b border-slate-200"></th>
              </tr>
              <tr className="divide-x divide-slate-200">
                <th className="px-4 py-4 sticky left-0 z-10 bg-white">{reportMode === 'summary' ? 'Asset Class' : 'Asset Details'}</th>
                {reportMode === 'detailed' && <><th className="px-2 py-4 text-center">Tag ID</th><th className="px-2 py-4 text-center">Acq Date</th></>}
                <th className="px-2 py-4 text-center">Op Bal</th>
                <th className="px-2 py-4 text-center">Additions</th>
                {hasRevImp && <th className="px-2 py-4 text-center">Rev / Imp</th>}
                <th className="px-2 py-4 text-center">Disposals</th>
                <th className="px-2 py-4 text-center">Closing Cost</th>
                <th className="px-2 py-4 text-center">Op Accum</th>
                <th className="px-2 py-4 text-center">Charge</th>
                <th className="px-2 py-4 text-center">On Disposal</th>
                <th className="px-2 py-4 text-center">Cl Accum</th>
                <th className="px-4 py-4 text-right bg-slate-900 text-white min-w-[120px]">
                  {activeView === 'ifrs' ? 'Carrying Value' : 'Tax Value'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {Object.keys(groupedCalculations).length === 0 ? (
                <tr><td colSpan={14} className="px-4 py-24 text-center text-slate-300 font-bold uppercase tracking-widest">No assets selected for display</td></tr>
              ) : (
                <>
                  {Object.keys(groupedCalculations).map(catId => {
                    const category = categories.find(c => c.id === catId);
                    const items = groupedCalculations[catId] as DepreciationCalculation[];
                    const t = groupTotals[catId];
                    const isSars = activeView === 'sars';

                    return (
                      <React.Fragment key={catId}>
                        {reportMode === 'detailed' && (
                          <>
                            <tr className="bg-slate-50 border-y border-slate-200"><td colSpan={14} className="px-4 py-2 font-black text-[9px] text-slate-400 uppercase tracking-widest border-l-4 border-blue-500">Class: {category?.name}</td></tr>
                            {items.map(calc => {
                              const asset = assets.find(a => a.id === calc.assetId)!;
                              return (
                                <tr key={calc.assetId} className="hover:bg-slate-50 divide-x divide-slate-100 transition-colors">
                                  <td className="px-4 py-3 sticky left-0 z-10 bg-white font-bold text-slate-800">
                                    <span className="block truncate max-w-[150px]">{asset.name}</span>
                                    <span className="block text-[8px] text-slate-400 font-mono tracking-tighter">{asset.assetNumber}</span>
                                  </td>
                                  <td className="px-2 py-3 text-center text-slate-500">{asset.tagId || '-'}</td>
                                  <td className="px-2 py-3 text-center text-slate-500 font-mono">{getAcqDate(asset)}</td>
                                  <td className="px-2 py-3 text-right font-mono">{currencyFormatter.format(calc.openingCost)}</td>
                                  <td className="px-2 py-3 text-right text-emerald-600 font-mono">+{currencyFormatter.format(calc.additions)}</td>
                                  {hasRevImp && <td className="px-2 py-3 text-right font-mono">{currencyFormatter.format(calc.revaluations - calc.impairments)}</td>}
                                  <td className="px-2 py-3 text-right text-red-600 font-mono">-{currencyFormatter.format(calc.disposals)}</td>
                                  <td className="px-2 py-3 text-right font-black font-mono">{currencyFormatter.format(calc.closingCost)}</td>
                                  <td className="px-2 py-3 text-right text-slate-400 font-mono">{currencyFormatter.format(isSars ? calc.openingAccumulatedTaxDepr : calc.openingAccumulatedDepr)}</td>
                                  <td className="px-2 py-3 text-right text-blue-600 font-mono">{currencyFormatter.format(isSars ? calc.taxDeductionForPeriod : calc.periodicDepr)}</td>
                                  <td className="px-2 py-3 text-right text-red-400 font-mono">-{currencyFormatter.format(isSars ? calc.taxDeprOnDisposals : calc.accumulatedDeprOnDisposals)}</td>
                                  <td className="px-2 py-3 text-right font-black font-mono">{currencyFormatter.format(isSars ? calc.closingAccumulatedTaxDepr : calc.closingAccumulatedDepr)}</td>
                                  <td className="px-4 py-3 text-right bg-slate-50 font-black font-mono">{currencyFormatter.format(isSars ? calc.taxValue : calc.nbv)}</td>
                                </tr>
                              );
                            })}
                          </>
                        )}
                        <tr className={`${reportMode === 'summary' ? 'hover:bg-slate-50' : 'bg-slate-100/50'} font-black divide-x divide-slate-200 border-t border-slate-200`}>
                          <td colSpan={reportMode === 'detailed' ? 3 : 1} className="px-4 py-3 text-left uppercase tracking-widest text-[8px] text-slate-500">
                            {reportMode === 'summary' ? category?.name : `Subtotal: ${category?.name}`}
                          </td>
                          <td className="px-2 py-3 text-right font-mono">{currencyFormatter.format(t.openingCost)}</td>
                          <td className="px-2 py-3 text-right font-mono text-emerald-600">{currencyFormatter.format(t.additions)}</td>
                          {hasRevImp && <td className="px-2 py-3 text-right font-mono">{currencyFormatter.format(t.revalImp)}</td>}
                          <td className="px-2 py-3 text-right font-mono text-red-600">{currencyFormatter.format(t.disposals)}</td>
                          <td className="px-2 py-3 text-right font-mono">{currencyFormatter.format(t.closingCost)}</td>
                          <td className="px-2 py-3 text-right font-mono text-slate-500">{currencyFormatter.format(t.openingDepr)}</td>
                          <td className="px-2 py-3 text-right font-mono text-blue-600">{currencyFormatter.format(t.periodicDepr)}</td>
                          <td className="px-2 py-3 text-right font-mono text-red-400">-{currencyFormatter.format(t.disposalDepr)}</td>
                          <td className="px-2 py-3 text-right font-mono">{currencyFormatter.format(t.closingDepr)}</td>
                          <td className="px-4 py-3 text-right bg-slate-200/50 font-mono">{currencyFormatter.format(t.carryingValue)}</td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                  
                  <tr className="bg-slate-900 text-white font-black divide-x divide-slate-800 border-t-2 border-slate-900">
                    <td colSpan={reportMode === 'detailed' ? 3 : 1} className="px-4 py-5 text-right uppercase tracking-widest text-[10px]">GRAND TOTAL (CONSOLIDATED)</td>
                    <td className="px-2 py-5 text-right font-mono">{currencyFormatter.format(grandTotals.openingCost)}</td>
                    <td className="px-2 py-5 text-right font-mono text-emerald-400">{currencyFormatter.format(grandTotals.additions)}</td>
                    {hasRevImp && <td className="px-2 py-5 text-right font-mono">{currencyFormatter.format(grandTotals.revalImp)}</td>}
                    <td className="px-2 py-5 text-right font-mono text-red-400">{currencyFormatter.format(grandTotals.disposals)}</td>
                    <td className="px-2 py-5 text-right font-mono">{currencyFormatter.format(grandTotals.closingCost)}</td>
                    <td className="px-2 py-5 text-right font-mono opacity-70">{currencyFormatter.format(grandTotals.openingDepr)}</td>
                    <td className="px-2 py-5 text-right font-mono text-blue-300">{currencyFormatter.format(grandTotals.periodicDepr)}</td>
                    <td className="px-2 py-5 text-right font-mono text-red-400">{currencyFormatter.format(grandTotals.disposalDepr)}</td>
                    <td className="px-2 py-5 text-right font-mono">{currencyFormatter.format(grandTotals.closingDepr)}</td>
                    <td className="px-4 py-5 text-right bg-black/30 font-mono text-lg">{currencyFormatter.format(grandTotals.carryingValue)}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default ReportingSuite;