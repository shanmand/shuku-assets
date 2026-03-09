
export enum DepreciationMethod {
  STRAIGHT_LINE = 'Straight Line',
  REDUCING_BALANCE = 'Reducing Balance',
}

export enum TaxStrategy {
  STANDARD_FLAT = 'Standard Flat Rate (Pro-rated)',
  SARS_12C_40_20 = 'SARS Sec 12C (40/20/20/20)',
  SARS_12B_50_30_20 = 'SARS Sec 12B (50/30/20)',
  SARS_FULL_100 = 'SARS Full Write-off (100%)',
  SARS_13_5 = 'SARS Sec 13 (5% Straight Line)',
}

export enum AssetStatus {
  ACTIVE = 'Active',
  DISPOSED = 'Disposed',
  SCRAPPED = 'Scrapped',
  IMPAIRED = 'Impaired',
}

export enum TransactionType {
  ACQUISITION = 'Acquisition',
  TRANSFER = 'Transfer',
  DISPOSAL = 'Disposal',
  SCRAP = 'Scrap',
  MAINTENANCE = 'Maintenance',
  INSPECTION = 'Inspection',
  REVALUATION = 'Revaluation',
  IMPAIRMENT = 'Impairment'
}

export type LocationType = 'Branch' | 'Location' | 'Sublocation';

export interface AssetLocation {
  id: string;
  name: string;
  code: string;
  type: LocationType;
  parentId?: string;
}

export interface AssetCategory {
  id: string;
  name: string;
  defaultUsefulLife: number;
  defaultTaxRate: number;
  residualPercentage: number;
  taxStrategy: TaxStrategy;
  glCodeCost: string;
  glCodeAccumDepr: string;
  glCodeDeprExpense: string;
  glCodeRevaluationSurplus?: string;
}

export interface RevaluationEvent {
  id: string;
  date: string;
  newFairValue: number;
  reason: string;
}

export interface AssetComponent {
  id: string;
  name: string;
  acquisitionDate: string;
  cost: number;
  residualValue: number;
  usefulLifeYears: number;
  taxRate: number;
  status: AssetStatus;
  disposalDate?: string;
  disposalProceeds?: number;
  supplierName?: string;
  supplierContact?: string;
  invoiceNumber?: string;
  revaluations?: RevaluationEvent[];
  impairmentLoss?: number;
}

export interface Asset {
  id: string;
  assetNumber: string;
  tagId: string;
  name: string;
  description: string;
  categoryId: string;
  branchId: string;
  locationId: string;
  subLocationId: string;
  status: AssetStatus;
  components: AssetComponent[];
}

export interface DatabaseConfig {
  enabled: boolean;
  supabaseUrl: string;
  supabaseKey: string;
  lastSync?: string;
}

export interface DepreciationCalculation {
  assetId: string;
  openingCost: number;
  additions: number;
  disposals: number;
  revaluations: number;
  impairments: number;
  closingCost: number;
  openingAccumulatedDepr: number;
  periodicDepr: number;
  accumulatedDeprOnDisposals: number;
  closingAccumulatedDepr: number;
  nbv: number;
  taxValue: number;
  taxDeductionForPeriod: number;
  openingAccumulatedTaxDepr: number;
  taxDeprOnDisposals: number;
  closingAccumulatedTaxDepr: number;
  taxYearOfAsset: number;
  profitOnDisposal?: number;
  recoupment?: number;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  assetId: string;
  action: string;
  changes: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
}

export interface JournalEntry {
  id: string;
  date: string;
  accountName: string;
  accountCode: string;
  description: string;
  debit: number;
  credit: number;
  branchId: string;
}
