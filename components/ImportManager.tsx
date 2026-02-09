import React, { useState } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Download, Table } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Asset, AssetStatus, AssetCategory, AssetLocation } from '../types';

interface ImportManagerProps {
  onImport: (assets: Asset[]) => void;
  categories: AssetCategory[];
  locations: AssetLocation[];
}

const ImportManager: React.FC<ImportManagerProps> = ({ onImport, categories, locations }) => {
  const [status, setStatus] = useState<{ type: 'idle' | 'success' | 'error', message?: string }>({ type: 'idle' });

  // Helper to convert Excel Serial Dates to ISO strings
  const parseExcelDate = (val: any) => {
    if (!val) return new Date().toISOString().split('T')[0];
    
    // If it's already a string in YYYY-MM-DD format
    if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) return val;

    // Handle Excel Serial Number
    if (typeof val === 'number') {
      const date = new Date((val - (25567 + 1)) * 86400 * 1000);
      return date.toISOString().split('T')[0];
    }

    // Try normal JS Date parsing
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];

    return new Date().toISOString().split('T')[0];
  };

  const downloadTemplate = () => {
    const data = [
      {
        AssetNumber: 'LUP-MAC-001',
        Name: 'Industrial Dough Mixer',
        TagId: 'RFID-8832-XJ',
        Category: categories[0]?.name || 'General Equipment',
        Branch: locations.find(l => l.type === 'Branch')?.name || 'Lupo Head Office',
        Location: 'Kitchen A',
        SubLocation: 'Bay 1',
        Cost: 55000,
        AcquisitionDate: '2023-01-15',
        UsefulLife: 10,
        TaxRate: 20,
        SupplierName: 'Bakery Pro Ltd',
        InvoiceNumber: 'INV-9988'
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
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        const newAssets: Asset[] = data.map((row: any) => {
          // 1. SMART MATCHING: CATEGORY
          const rowCategoryName = String(row.Category || '').trim().toLowerCase();
          const category = categories.find(c => c.name.trim().toLowerCase() === rowCategoryName) || categories[0];
          
          // 2. SMART MATCHING: BRANCH
          const rowBranchName = String(row.Branch || '').trim().toLowerCase();
          const branch = locations.find(l => l.type === 'Branch' && l.name.trim().toLowerCase() === rowBranchName) || locations.find(l => l.type === 'Branch') || locations[0];
          
          // 3. SMART MATCHING: FUNCTIONAL LOCATION (Parent = Branch)
          const rowLocationName = String(row.Location || '').trim().toLowerCase();
          const functionalLocation = locations.find(l => 
            l.type === 'Location' && 
            l.parentId === branch.id && 
            l.name.trim().toLowerCase() === rowLocationName
          );

          // 4. SMART MATCHING: SUB-LOCATION (Parent = Functional Location)
          const rowSubLocationName = String(row.SubLocation || '').trim().toLowerCase();
          const subLocation = functionalLocation ? locations.find(l => 
            l.type === 'Sublocation' && 
            l.parentId === functionalLocation.id && 
            l.name.trim().toLowerCase() === rowSubLocationName
          ) : undefined;
          
          return {
            id: Math.random().toString(36).substr(2, 9),
            assetNumber: String(row.AssetNumber || row['Asset No'] || '').toUpperCase(),
            tagId: String(row.TagId || row['Tag ID'] || row['Electronic Tag'] || row['RFID'] || ''),
            name: String(row.Name || 'Imported Asset'),
            description: String(row.Description || ''),
            categoryId: category.id,
            branchId: branch.id,
            locationId: functionalLocation?.id || '',
            subLocationId: subLocation?.id || '',
            status: AssetStatus.ACTIVE,
            components: [{
              id: 'primary',
              name: 'Primary Unit',
              acquisitionDate: parseExcelDate(row.AcquisitionDate),
              cost: Number(row.Cost || 0),
              residualValue: Number(row.ResidualValue || (Number(row.Cost || 0) * (category.residualPercentage / 100))),
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
        setStatus({ type: 'success', message: `Batch Process Complete: ${newAssets.length} records verified and ingested.` });
      } catch (err) {
        console.error("Import Error:", err);
        setStatus({ type: 'error', message: 'Engine Fault: Could not parse binary data. Ensure you use the provided template.' });
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="bg-white p-12 rounded-3xl border-2 border-dashed border-slate-200 text-center space-y-8 shadow-inner animate-in zoom-in-95 duration-300">
      <div className="mx-auto w-24 h-24 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center shadow-xl rotate-3">
        <Upload size={48} />
      </div>
      
      <div>
        <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Bulk Asset Ingestion</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto mt-2 leading-relaxed font-medium">
          Load thousands of assets in seconds. Our engine maps Excel rows to your configured <span className="text-blue-600 font-bold">Asset Classes</span> and <span className="text-blue-600 font-bold">Locations</span> automatically.
        </p>
      </div>

      <div className="pt-4 flex flex-col items-center gap-6">
        <label className="bg-slate-900 text-white px-10 py-5 rounded-2xl cursor-pointer hover:bg-black transition-all font-black uppercase tracking-widest text-xs flex items-center gap-3 shadow-2xl shadow-slate-200 active:scale-95 group">
          <FileSpreadsheet size={20} className="group-hover:text-blue-400 transition-colors" />
          Select Spreadsheet File
          <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} />
        </label>
        
        <button onClick={downloadTemplate} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-600 flex items-center gap-1.5 transition-all">
          <Download size={14} /> Download System Template
        </button>
      </div>

      {status.type === 'success' && (
        <div className="mt-4 p-5 bg-emerald-50 text-emerald-700 rounded-2xl flex items-center justify-center gap-4 border border-emerald-100 animate-in slide-in-from-top-4 shadow-sm">
          <CheckCircle2 size={24} />
          <span className="text-xs font-black uppercase tracking-widest">{status.message}</span>
        </div>
      )}

      {status.type === 'error' && (
        <div className="mt-4 p-5 bg-red-50 text-red-700 rounded-2xl flex items-center justify-center gap-4 border border-red-100 animate-in slide-in-from-top-4 shadow-sm">
          <AlertCircle size={24} />
          <span className="text-xs font-black uppercase tracking-widest">{status.message}</span>
        </div>
      )}

      <div className="pt-10 text-left border-t border-slate-100">
        <div className="flex items-center gap-2 mb-6">
           <Table size={16} className="text-slate-400" />
           <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Required Schema Mapping</h4>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 text-[9px] font-black uppercase tracking-tighter">
          {[
            'AssetNumber', 'Name', 'TagId', 'Category', 'Branch', 'Location', 'SubLocation',
            'Cost', 'AcquisitionDate', 'UsefulLife', 'TaxRate', 'SupplierName', 'InvoiceNumber'
          ].map(col => (
            <div key={col} className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-slate-500 flex items-center gap-2">
              <div className="w-1 h-1 bg-slate-300 rounded-full"></div> {col}
            </div>
          ))}
        </div>
        <p className="mt-6 text-[9px] text-slate-400 font-medium italic">
          * Ensure names in 'Category', 'Branch', and 'Location' columns exactly match your current system settings to avoid unmapped assets.
        </p>
      </div>
    </div>
  );
};

export default ImportManager;