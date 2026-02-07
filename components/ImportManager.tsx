
import React, { useState } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Asset, AssetStatus } from '../types';
import { ASSET_CATEGORIES, ORGANIZATIONAL_UNITS } from '../constants';

interface ImportManagerProps {
  onImport: (assets: Asset[]) => void;
}

const ImportManager: React.FC<ImportManagerProps> = ({ onImport }) => {
  const [status, setStatus] = useState<{ type: 'idle' | 'success' | 'error', message?: string }>({ type: 'idle' });

  const downloadTemplate = () => {
    const data = [
      {
        AssetNumber: 'EQP-001',
        Name: 'Industrial Oven',
        Category: 'Bakery Machinery (12C)',
        Branch: 'Lupo Head Office',
        Location: 'Kitchen A',
        Cost: 55000,
        AcquisitionDate: '2023-01-15',
        UsefulLife: 10,
        TaxRate: 20,
        SupplierName: 'Bakery Pro Ltd',
        InvoiceNumber: 'INV-9988'
      },
      {
        AssetNumber: 'VEH-042',
        Name: 'Delivery Van',
        Category: 'General Equipment',
        Branch: 'Lupo Head Office',
        Location: 'Parking Bay 1',
        Cost: 285000,
        AcquisitionDate: '2024-02-01',
        UsefulLife: 5,
        TaxRate: 20,
        SupplierName: 'City Motors',
        InvoiceNumber: 'CM-2024-001'
      }
    ];
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "Shuku_Asset_Import_Template.xlsx");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        const newAssets: Asset[] = data.map((row: any) => {
          const category = ASSET_CATEGORIES.find(c => c.name.toLowerCase() === (row.Category || '').toLowerCase()) || ASSET_CATEGORIES[0];
          const branch = ORGANIZATIONAL_UNITS.find(u => u.name.toLowerCase() === (row.Branch || '').toLowerCase() && u.type === 'Branch') || ORGANIZATIONAL_UNITS[0];
          
          return {
            id: Math.random().toString(36).substr(2, 9),
            assetNumber: String(row.AssetNumber || row['Asset No'] || ''),
            tagId: String(row.TagId || row['Tag ID'] || ''),
            name: String(row.Name || ''),
            description: String(row.Description || ''),
            categoryId: category.id,
            branchId: branch.id,
            locationId: ORGANIZATIONAL_UNITS.find(u => u.name.toLowerCase() === (row.Location || '').toLowerCase() && u.parentId === branch.id)?.id || '',
            subLocationId: '',
            status: AssetStatus.ACTIVE,
            components: [{
              id: 'primary',
              name: 'Imported Component',
              acquisitionDate: row.AcquisitionDate || new Date().toISOString().split('T')[0],
              cost: Number(row.Cost || 0),
              residualValue: Number(row.ResidualValue || 0),
              usefulLifeYears: Number(row.UsefulLife || category.defaultUsefulLife),
              taxRate: Number(row.TaxRate || category.defaultTaxRate),
              status: AssetStatus.ACTIVE,
              supplierName: row.SupplierName || row.Supplier || '',
              supplierContact: row.SupplierContact || '',
              invoiceNumber: row.InvoiceNumber || row.Invoice || ''
            }]
          };
        });

        onImport(newAssets);
        setStatus({ type: 'success', message: `Successfully imported ${newAssets.length} assets.` });
      } catch (err) {
        setStatus({ type: 'error', message: 'Failed to parse file. Please check the template format.' });
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="bg-white p-12 rounded-2xl border-2 border-dashed border-slate-200 text-center space-y-6 shadow-sm">
      <div className="mx-auto w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
        <Upload size={40} />
      </div>
      <div>
        <h3 className="text-xl font-bold text-slate-800">Bulk Import Asset Registry</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto mt-2 leading-relaxed">
          Upload an Excel or CSV file to import historical data. 
          Use our <button onClick={downloadTemplate} className="text-blue-600 font-bold underline hover:text-blue-800 transition">Template</button> for best results.
        </p>
      </div>

      <div className="pt-4 flex flex-col items-center gap-4">
        <label className="bg-[#1e3a5f] text-white px-8 py-3.5 rounded-xl cursor-pointer hover:bg-blue-900 transition-all font-bold flex items-center gap-3 w-fit shadow-lg shadow-blue-100 active:scale-95">
          <FileSpreadsheet size={20} />
          Select Spreadsheet File
          <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} />
        </label>
        
        <button onClick={downloadTemplate} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-600 flex items-center gap-1.5 transition">
          <Download size={12} /> Download Sample Template
        </button>
      </div>

      {status.type === 'success' && (
        <div className="mt-4 p-4 bg-emerald-50 text-emerald-700 rounded-xl flex items-center justify-center gap-3 border border-emerald-100 animate-in slide-in-from-top-2">
          <CheckCircle2 size={18} />
          <span className="text-sm font-bold uppercase tracking-tight">{status.message}</span>
        </div>
      )}

      {status.type === 'error' && (
        <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-xl flex items-center justify-center gap-3 border border-red-100 animate-in slide-in-from-top-2">
          <AlertCircle size={18} />
          <span className="text-sm font-bold uppercase tracking-tight">{status.message}</span>
        </div>
      )}

      <div className="pt-8 text-left border-t border-slate-100">
        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Required Column Mapping</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[9px] font-mono text-slate-600">
          <div className="bg-slate-50 p-2 rounded border border-slate-200">AssetNumber</div>
          <div className="bg-slate-50 p-2 rounded border border-slate-200">Name</div>
          <div className="bg-slate-50 p-2 rounded border border-slate-200">Category</div>
          <div className="bg-slate-50 p-2 rounded border border-slate-200">Branch</div>
          <div className="bg-slate-50 p-2 rounded border border-slate-200">Cost</div>
          <div className="bg-slate-50 p-2 rounded border border-slate-200">AcquisitionDate</div>
          <div className="bg-slate-50 p-2 rounded border border-slate-200">UsefulLife</div>
          <div className="bg-slate-50 p-2 rounded border border-slate-200">TaxRate</div>
        </div>
      </div>
    </div>
  );
};

export default ImportManager;
