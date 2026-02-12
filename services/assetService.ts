import { differenceInDays, isBefore, isAfter, isValid } from 'date-fns';
import { Asset, DepreciationCalculation, AssetComponent, TaxStrategy, AssetCategory, AssetStatus } from '../types';

const FISCAL_YEAR_END_MONTH = 5; // June (0-indexed in JS)
const FISCAL_YEAR_END_DAY = 30;

const subDays = (date: Date, amount: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() - amount);
  return result;
};

const startOfDay = (date: Date): Date => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

/**
 * Returns the fiscal year for a given date based on June 30th end.
 * e.g. 2023-06-15 is FY 2023. 2023-07-01 is FY 2024.
 */
const getFiscalYear = (date: Date): number => {
  const year = date.getFullYear();
  const month = date.getMonth();
  if (month <= FISCAL_YEAR_END_MONTH) {
    return year;
  }
  return year + 1;
};

const getTaxYearDeduction = (
  comp: AssetComponent, 
  strategy: TaxStrategy, 
  taxYear: number
): number => {
  if (taxYear < 1) return 0;
  
  switch (strategy) {
    case TaxStrategy.SARS_12C_40_20:
      if (taxYear === 1) return comp.cost * 0.40;
      if (taxYear >= 2 && taxYear <= 4) return comp.cost * 0.20;
      return 0;
    case TaxStrategy.SARS_12B_50_30_20:
      if (taxYear === 1) return comp.cost * 0.50;
      if (taxYear === 2) return comp.cost * 0.30;
      if (taxYear === 3) return comp.cost * 0.20;
      return 0;
    case TaxStrategy.SARS_FULL_100:
      return taxYear === 1 ? comp.cost : 0;
    case TaxStrategy.SARS_13_5:
      // Section 13 is typically 5% straight line per annum
      return taxYear <= 20 ? comp.cost * 0.05 : 0;
    default:
      return 0;
  }
};

const calculateComponentDepreciation = (
  comp: AssetComponent,
  reportStartDate: Date,
  reportEndDate: Date,
  category: AssetCategory
) => {
  const acqDate = startOfDay(new Date(comp.acquisitionDate));
  const dispDate = (comp.status === AssetStatus.DISPOSED || comp.status === AssetStatus.SCRAPPED) && comp.disposalDate 
    ? startOfDay(new Date(comp.disposalDate)) 
    : null;
  
  const getIFRSValuesAt = (targetDate: Date) => {
    const normalizedTarget = startOfDay(targetDate);
    
    // If targeted date is before acquisition, everything is 0
    if (isBefore(normalizedTarget, acqDate)) {
      return { cost: 0, accumDepr: 0, impairments: 0, revaluations: 0, residual: 0 };
    }
    
    // If targeted date is ON or AFTER disposal date, balance sheet values are 0
    if (dispDate && (isAfter(normalizedTarget, subDays(dispDate, 1)) || normalizedTarget.getTime() === dispDate.getTime())) {
      return { cost: 0, accumDepr: 0, impairments: 0, revaluations: 0, residual: 0 };
    }

    const effectiveDeprEnd = dispDate && isAfter(normalizedTarget, subDays(dispDate, 1)) ? subDays(dispDate, 1) : normalizedTarget;
    const daysHeld = Math.max(0, differenceInDays(effectiveDeprEnd, acqDate) + 1);
    
    const relevantRevals = (comp.revaluations || [])
      .filter(r => !isAfter(startOfDay(new Date(r.date)), normalizedTarget))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    const totalRevalImpact = relevantRevals.reduce((acc, curr) => curr.newFairValue - comp.cost, 0);
    const totalImpairment = (comp.impairmentLoss || 0);

    const grossCarryingAmount = comp.cost + totalRevalImpact - totalImpairment;
    const residual = comp.residualValue || 0;
    const depreciableAmount = Math.max(0, grossCarryingAmount - residual);
    
    const annualDepr = comp.usefulLifeYears > 0 ? depreciableAmount / comp.usefulLifeYears : 0;
    const dailyDeprRate = annualDepr / 365.25;
    const accumDepr = Math.min(depreciableAmount, dailyDeprRate * daysHeld);
    
    return { 
      cost: comp.cost, 
      accumDepr, 
      impairments: totalImpairment, 
      revaluations: totalRevalImpact,
      residual
    };
  };

  const getSARSValuesAt = (targetDate: Date) => {
    const normalizedTarget = startOfDay(targetDate);
    if (isBefore(normalizedTarget, acqDate)) return { cost: 0, taxValue: 0, accumTaxDepr: 0, currentTaxYear: 0 };
    
    if (dispDate && (isAfter(normalizedTarget, subDays(dispDate, 1)) || normalizedTarget.getTime() === dispDate.getTime())) {
       return { cost: 0, taxValue: 0, accumTaxDepr: 0, currentTaxYear: 0 };
    }

    const daysHeld = Math.max(0, differenceInDays(normalizedTarget, acqDate) + 1);
    const fyAcq = getFiscalYear(acqDate);
    const fyTarget = getFiscalYear(normalizedTarget);
    const currentTaxYear = Math.max(1, fyTarget - fyAcq + 1);
    
    let accumTaxDepr = 0;

    if (category.taxStrategy === TaxStrategy.STANDARD_FLAT) {
      const annualTaxDepr = comp.cost * (category.defaultTaxRate / 100);
      accumTaxDepr = Math.min(comp.cost, (annualTaxDepr / 365.25) * daysHeld);
    } else {
      for (let y = 1; y <= currentTaxYear; y++) {
        accumTaxDepr += getTaxYearDeduction(comp, category.taxStrategy, y);
      }
      accumTaxDepr = Math.min(comp.cost, accumTaxDepr);
    }

    return { 
      cost: comp.cost, 
      taxValue: Math.max(0, comp.cost - accumTaxDepr),
      accumTaxDepr,
      currentTaxYear
    };
  };

  const dayBeforeStart = subDays(reportStartDate, 1);
  const ifrsOp = getIFRSValuesAt(dayBeforeStart);
  const ifrsCl = getIFRSValuesAt(reportEndDate);
  const sarsOp = getSARSValuesAt(dayBeforeStart);
  const sarsCl = getSARSValuesAt(reportEndDate);

  const additions = (isAfter(acqDate, dayBeforeStart) && (isBefore(acqDate, reportEndDate) || acqDate.getTime() === startOfDay(reportEndDate).getTime())) ? comp.cost : 0;
  
  const periodicRevals = ifrsCl.revaluations - ifrsOp.revaluations;
  const periodicImpairments = ifrsCl.impairments - ifrsOp.impairments;

  let disposals = 0;
  let accumDeprOnDisp = 0;
  let taxDeprOnDisp = 0;
  let profitOnDisp = 0;
  let recoupment = 0;

  if (dispDate && isAfter(dispDate, dayBeforeStart) && (isBefore(dispDate, reportEndDate) || dispDate.getTime() === startOfDay(reportEndDate).getTime())) {
    // For movement schedule, "disposals" column represents the carrying amount being REMOVED.
    // We get values at the day before disposal to see what was actually on the books.
    const dayBeforeDisp = subDays(dispDate, 1);
    const valAtDisp = getIFRSValuesAt(dayBeforeDisp);
    const taxValAtDisp = getSARSValuesAt(dayBeforeDisp);

    disposals = valAtDisp.cost + valAtDisp.revaluations - valAtDisp.impairments;
    accumDeprOnDisp = valAtDisp.accumDepr;
    taxDeprOnDisp = taxValAtDisp.accumTaxDepr;

    const nbvAtDisp = disposals - accumDeprOnDisp;
    profitOnDisp = (comp.disposalProceeds || 0) - nbvAtDisp;
    
    const proceeds = comp.disposalProceeds || 0;
    if (proceeds > taxValAtDisp.taxValue) {
      recoupment = Math.min(proceeds - taxValAtDisp.taxValue, comp.cost - taxValAtDisp.taxValue);
    }
  }

  // Periodic depreciation (The "Charge")
  // Movement Formula: Closing Accum = Opening Accum + Charge - DisposalsAccum
  // Therefore: Charge = Closing Accum - Opening Accum + DisposalsAccum
  const periodicDepr = Math.max(0, ifrsCl.accumDepr - ifrsOp.accumDepr + accumDeprOnDisp);
  const taxDedForPeriod = Math.max(0, sarsCl.accumTaxDepr - sarsOp.accumTaxDepr + taxDeprOnDisp);

  return {
    openingCost: ifrsOp.cost + ifrsOp.revaluations - ifrsOp.impairments,
    additions,
    disposals,
    revaluations: periodicRevals,
    impairments: periodicImpairments,
    closingCost: ifrsCl.cost + ifrsCl.revaluations - ifrsCl.impairments,
    openingAccumulatedDepr: ifrsOp.accumDepr,
    periodicDepr,
    accumulatedDeprOnDisposals: accumDeprOnDisp,
    closingAccumulatedDepr: ifrsCl.accumDepr,
    nbv: Math.max(ifrsCl.residual, (ifrsCl.cost + ifrsCl.revaluations - ifrsCl.impairments) - ifrsCl.accumDepr),
    taxValue: sarsCl.taxValue,
    taxDeductionForPeriod: taxDedForPeriod,
    openingAccumulatedTaxDepr: sarsOp.accumTaxDepr,
    taxDeprOnDisposals: taxDeprOnDisp,
    closingAccumulatedTaxDepr: sarsCl.accumTaxDepr,
    taxYearOfAsset: sarsCl.currentTaxYear,
    profitOnDisposal: profitOnDisp,
    recoupment: recoupment,
    hasDisposal: disposals > 0
  };
};

export const calculateDepreciation = (
  asset: Asset,
  reportStartDate: Date,
  reportEndDate: Date,
  categories: AssetCategory[]
): DepreciationCalculation => {
  const category = categories.find(c => c.id === asset.categoryId);
  
  if (!category) {
    return {
      assetId: asset.id,
      openingCost: 0, additions: 0, disposals: 0, revaluations: 0, impairments: 0, closingCost: 0,
      openingAccumulatedDepr: 0, periodicDepr: 0, accumulatedDeprOnDisposals: 0,
      closingAccumulatedDepr: 0, nbv: 0, taxValue: 0, taxDeductionForPeriod: 0,
      openingAccumulatedTaxDepr: 0, taxDeprOnDisposals: 0, closingAccumulatedTaxDepr: 0,
      taxYearOfAsset: 0
    };
  }

  const results = asset.components.map(c => calculateComponentDepreciation(c, reportStartDate, reportEndDate, category));

  const total = results.reduce((acc, curr) => ({
    openingCost: acc.openingCost + curr.openingCost,
    additions: acc.additions + curr.additions,
    disposals: acc.disposals + curr.disposals,
    revaluations: acc.revaluations + curr.revaluations,
    impairments: acc.impairments + curr.impairments,
    closingCost: acc.closingCost + curr.closingCost,
    openingAccumulatedDepr: acc.openingAccumulatedDepr + curr.openingAccumulatedDepr,
    periodicDepr: acc.periodicDepr + curr.periodicDepr,
    accumulatedDeprOnDisposals: acc.accumulatedDeprOnDisposals + curr.accumulatedDeprOnDisposals,
    closingAccumulatedDepr: acc.closingAccumulatedDepr + curr.closingAccumulatedDepr,
    nbv: acc.nbv + curr.nbv,
    taxValue: acc.taxValue + curr.taxValue,
    taxDeductionForPeriod: acc.taxDeductionForPeriod + curr.taxDeductionForPeriod,
    openingAccumulatedTaxDepr: acc.openingAccumulatedTaxDepr + curr.openingAccumulatedTaxDepr,
    taxDeprOnDisposals: acc.taxDeprOnDisposals + curr.taxDeprOnDisposals,
    closingAccumulatedTaxDepr: acc.closingAccumulatedTaxDepr + curr.closingAccumulatedTaxDepr,
    taxYearOfAsset: Math.max(acc.taxYearOfAsset, curr.taxYearOfAsset),
    profitOnDisposal: acc.profitOnDisposal + curr.profitOnDisposal,
    recoupment: acc.recoupment + curr.recoupment,
    hasAnyDisposal: acc.hasAnyDisposal || curr.hasDisposal
  }), {
    openingCost: 0, additions: 0, disposals: 0, revaluations: 0, impairments: 0, closingCost: 0,
    openingAccumulatedDepr: 0, periodicDepr: 0, accumulatedDeprOnDisposals: 0,
    closingAccumulatedDepr: 0, nbv: 0, taxValue: 0, taxDeductionForPeriod: 0,
    openingAccumulatedTaxDepr: 0, taxDeprOnDisposals: 0, closingAccumulatedTaxDepr: 0,
    taxYearOfAsset: 0, profitOnDisposal: 0, recoupment: 0, hasAnyDisposal: false
  });

  return {
    assetId: asset.id,
    ...total,
    profitOnDisposal: total.hasAnyDisposal ? total.profitOnDisposal : 0,
    recoupment: total.hasAnyDisposal ? total.recoupment : 0
  };
};