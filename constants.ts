
import { Asset, AssetCategory, AssetLocation, TaxStrategy } from './types';

export const ASSET_CATEGORIES: AssetCategory[] = [
  {
    id: 'cat-gen-001',
    name: 'General Equipment',
    defaultUsefulLife: 5,
    defaultTaxRate: 20,
    residualPercentage: 0,
    taxStrategy: TaxStrategy.STANDARD_FLAT,
    glCodeCost: '1000/001',
    glCodeAccumDepr: '1000/002',
    glCodeDeprExpense: '5000/001'
  },
  {
    id: 'cat-bak-001',
    name: 'Bakery Machinery (12C)',
    defaultUsefulLife: 10,
    defaultTaxRate: 20,
    residualPercentage: 5,
    taxStrategy: TaxStrategy.SARS_12C_40_20,
    glCodeCost: '1000/100',
    glCodeAccumDepr: '1000/110',
    glCodeDeprExpense: '5000/100'
  }
];

export const ORGANIZATIONAL_UNITS: AssetLocation[] = [
  {
    id: 'br-hq',
    name: 'Lupo Head Office',
    code: 'HQ-01',
    type: 'Branch'
  }
];

export const MOCK_ASSETS: Asset[] = [];
