/**
 * Annual Tax Engine (Philippines - TRAIN Law)
 * Computes annual income tax based on TRAIN law brackets.
 * Used for BIR Form 2316 generation and year-end tax adjustments.
 */

// ─── TRAIN Law Tax Brackets (2026) ──────────────────────────

export interface TaxBracket {
  min: number;
  max: number;
  rate: number;
  fixedAmount: number;
}

export const TRAIN_TAX_BRACKETS_2026: TaxBracket[] = [
  { min: 0, max: 250000, rate: 0, fixedAmount: 0 },
  { min: 250001, max: 400000, rate: 0.15, fixedAmount: 0 },
  { min: 400001, max: 800000, rate: 0.20, fixedAmount: 22500 },
  { min: 800001, max: 2000000, rate: 0.25, fixedAmount: 102500 },
  { min: 2000001, max: 8000000, rate: 0.30, fixedAmount: 402500 },
  { min: 8000001, max: Infinity, rate: 0.35, fixedAmount: 2202500 },
];

// ─── Non-Taxable Income Thresholds ──────────────────────────

export const NON_TAXABLE_LIMITS = {
  /** 13th month pay and other benefits (non-taxable up to this amount) */
  thirteenthMonthAndBenefits: 90000,
  /** De minimis benefits (non-taxable) */
  deMinimis: {
    riceSubsidy: 2000, // per month
    uniformAllowance: 6000, // per year
    medicalAllowance: 10000, // per year
    laundryAllowance: 300, // per month
    achievementAwards: 10000, // per year
    christmasGift: 5000, // per year
    dailyMealAllowance: 150, // per day (for overtime)
  },
  /** SSS, PhilHealth, Pag-IBIG contributions (non-taxable) */
  mandatoryContributions: true,
} as const;

// ─── Annual Tax Computation ─────────────────────────────────

export interface AnnualTaxInput {
  /** Total gross compensation for the year */
  grossCompensation: number;
  /** Total 13th month pay received */
  thirteenthMonthPay: number;
  /** Other non-taxable benefits (de minimis, etc.) */
  otherNonTaxableBenefits: number;
  /** Total SSS contributions for the year */
  sssContributions: number;
  /** Total PhilHealth contributions for the year */
  philhealthContributions: number;
  /** Total Pag-IBIG contributions for the year */
  pagibigContributions: number;
  /** Total tax already withheld during the year */
  taxAlreadyWithheld: number;
  /** Whether employee is a minimum wage earner */
  isMinimumWageEarner?: boolean;
}

export interface AnnualTaxResult {
  grossCompensation: number;
  nonTaxableIncome: number;
  taxableIncome: number;
  annualTaxDue: number;
  taxAlreadyWithheld: number;
  overUnderWithholding: number; // positive = over-withheld (refund), negative = under-withheld (collect)
  effectiveTaxRate: number;
  bracket: TaxBracket;
}

/**
 * Compute annual income tax using TRAIN law brackets
 */
export function computeAnnualTax(
  input: AnnualTaxInput,
  brackets: TaxBracket[] = TRAIN_TAX_BRACKETS_2026
): AnnualTaxResult {
  // Minimum wage earners are exempt from income tax
  if (input.isMinimumWageEarner) {
    return {
      grossCompensation: input.grossCompensation,
      nonTaxableIncome: input.grossCompensation,
      taxableIncome: 0,
      annualTaxDue: 0,
      taxAlreadyWithheld: input.taxAlreadyWithheld,
      overUnderWithholding: input.taxAlreadyWithheld, // refund all withheld
      effectiveTaxRate: 0,
      bracket: brackets[0],
    };
  }

  // Compute non-taxable income
  const thirteenthMonthExempt = Math.min(input.thirteenthMonthPay, NON_TAXABLE_LIMITS.thirteenthMonthAndBenefits);
  const mandatoryContributions = input.sssContributions + input.philhealthContributions + input.pagibigContributions;
  const nonTaxableIncome = thirteenthMonthExempt + input.otherNonTaxableBenefits + mandatoryContributions;

  // Compute taxable income
  const taxableIncome = Math.max(0, input.grossCompensation - nonTaxableIncome);

  // Find applicable bracket
  const bracket = brackets.find((b) => taxableIncome >= b.min && taxableIncome <= b.max) ?? brackets[brackets.length - 1];

  // Compute tax due
  let annualTaxDue = 0;
  if (taxableIncome > 250000) {
    annualTaxDue = bracket.fixedAmount + ((taxableIncome - (bracket.min - 1)) * bracket.rate);
  }
  annualTaxDue = Math.round(annualTaxDue * 100) / 100;

  // Over/under withholding
  const overUnderWithholding = Math.round((input.taxAlreadyWithheld - annualTaxDue) * 100) / 100;

  // Effective tax rate
  const effectiveTaxRate = taxableIncome > 0 ? (annualTaxDue / taxableIncome) * 100 : 0;

  return {
    grossCompensation: input.grossCompensation,
    nonTaxableIncome,
    taxableIncome,
    annualTaxDue,
    taxAlreadyWithheld: input.taxAlreadyWithheld,
    overUnderWithholding,
    effectiveTaxRate: Math.round(effectiveTaxRate * 100) / 100,
    bracket,
  };
}

/**
 * Compute monthly withholding tax (for payroll processing)
 */
export function computeMonthlyWithholdingTax(
  monthlyTaxableIncome: number,
  brackets: TaxBracket[] = TRAIN_TAX_BRACKETS_2026
): number {
  // Annualize the monthly income
  const annualizedIncome = monthlyTaxableIncome * 12;

  // Find bracket
  const bracket = brackets.find((b) => annualizedIncome >= b.min && annualizedIncome <= b.max) ?? brackets[brackets.length - 1];

  // Compute annual tax
  let annualTax = 0;
  if (annualizedIncome > 250000) {
    annualTax = bracket.fixedAmount + ((annualizedIncome - (bracket.min - 1)) * bracket.rate);
  }

  // Return monthly portion
  return Math.round((annualTax / 12) * 100) / 100;
}
