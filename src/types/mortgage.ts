export type PaymentFrequency = 'monthly' | 'bi-weekly' | 'weekly' | 'accelerated-bi-weekly';

export interface RenewalPeriod {
  startPayment: number;
  annualRate: number;
  termYears: number;
}

export type AdditionalPaymentType = 'one-time' | 'recurring';

export interface AdditionalPayment {
  type: AdditionalPaymentType;
  amount: number;
  startPayment: number;
  endPayment?: number; // Optional: last payment number to apply this additional payment
  frequency?: number; // For recurring: every X payments (1 = every payment, 12 = annually, etc.)
  enabled?: boolean; // Optional: whether this payment is active (defaults to true)
}

export interface PrepaymentLimits {
  lumpSumLimitPercent: number; // Annual lump sum limit as % of original principal (e.g., 15 = 15%)
  paymentIncreaseLimitPercent: number; // Max % increase in payment allowed (e.g., 15 = 15%)
  resetPeriod: 'calendar' | 'anniversary'; // When limits reset (calendar year or mortgage anniversary)
}

export interface MortgageParams {
  purchasePrice: number;
  downPaymentPercent: number;
  additionalFinancing: number;
  cmhcPstRate: number;
  principal: number;
  amortizationYears: number;
  paymentFrequency: PaymentFrequency;
  startDate: Date;
  renewalPeriods: RenewalPeriod[];
  additionalPayments: AdditionalPayment[];
  prepaymentLimits?: PrepaymentLimits; // Optional prepayment privilege limits
}

export interface PaymentDetail {
  paymentNumber: number;
  paymentDate: Date;
  payment: number;
  principal: number;
  interest: number;
  additionalPayment: number;
  balance: number;
  interestRate: number;
  termNumber: number;
  exceedsLimit?: boolean; // True if this payment's additional payment exceeds contractual limits
}

export interface AmortizationSchedule {
  payments: PaymentDetail[];
  totalInterest: number;
  totalPrincipal: number;
  totalPayments: number;
  summary: {
    purchasePrice: number;
    downPayment: number;
    downPaymentPercent: number;
    mortgageAmount: number;
    cmhcInsurance: number;
    cmhcPremiumRate: number;
    cmhcPst: number;
    cmhcPstRate: number;
    additionalFinancing: number;
    originalPrincipal: number;
    totalInterestPaid: number;
    totalPaid: number;
    totalAdditionalPayments: number;
    interestSaved: number;
    timeSaved: number; // months saved
    amortizationYears: number;
    actualPayoffMonths: number;
    paymentFrequency: PaymentFrequency;
    prepaymentLimitViolations?: number; // Number of payments that exceed contractual limits
  };
}
