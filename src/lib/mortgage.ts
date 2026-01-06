import type {
  PaymentFrequency,
  MortgageParams,
  PaymentDetail,
  AmortizationSchedule,
  AdditionalPayment,
} from '../types/mortgage';

/**
 * Calculate CMHC insurance premium rate based on down payment percentage
 * In Canada, mortgage default insurance is required if down payment < 20%
 */
function getCMHCPremiumRate(downPaymentPercent: number): number {
  if (downPaymentPercent >= 20) {
    return 0; // No insurance required
  } else if (downPaymentPercent >= 15) {
    return 0.028; // 2.80% for 15-19.99% down
  } else if (downPaymentPercent >= 10) {
    return 0.031; // 3.10% for 10-14.99% down
  } else if (downPaymentPercent >= 5) {
    return 0.04; // 4.00% for 5-9.99% down
  } else {
    throw new Error('Down payment must be at least 5% for properties up to $500,000');
  }
}

/**
 * Calculate CMHC insurance and total principal
 * Additional financing (like home improvements) is added after CMHC calculation
 * Some provinces charge PST on CMHC insurance premiums
 */
export function calculateMortgageWithInsurance(
  purchasePrice: number,
  downPaymentPercent: number,
  additionalFinancing: number = 0,
  cmhcPstRate: number = 0
): {
  downPayment: number;
  mortgageAmount: number;
  cmhcPremiumRate: number;
  cmhcInsurance: number;
  cmhcPst: number;
  cmhcPstRate: number;
  additionalFinancing: number;
  totalPrincipal: number;
} {
  const downPayment = purchasePrice * (downPaymentPercent / 100);
  const mortgageAmount = purchasePrice - downPayment;
  const cmhcPremiumRate = getCMHCPremiumRate(downPaymentPercent);
  const cmhcInsurance = mortgageAmount * cmhcPremiumRate;
  const cmhcPst = cmhcInsurance * cmhcPstRate;
  const totalPrincipal = mortgageAmount + cmhcInsurance + cmhcPst + additionalFinancing;

  return {
    downPayment,
    mortgageAmount,
    cmhcPremiumRate,
    cmhcInsurance,
    cmhcPst,
    cmhcPstRate,
    additionalFinancing,
    totalPrincipal,
  };
}

/**
 * Get the number of payments per year for a given frequency
 */
function getPaymentsPerYear(frequency: PaymentFrequency): number {
  switch (frequency) {
    case 'monthly':
      return 12;
    case 'bi-weekly':
    case 'accelerated-bi-weekly':
      return 26;
    case 'weekly':
      return 52;
  }
}

/**
 * Convert annual interest rate to effective rate per payment period
 * Canadian mortgages use semi-annual compounding, not monthly
 */
function getPeriodicRate(annualRate: number, frequency: PaymentFrequency): number {
  const paymentsPerYear = getPaymentsPerYear(frequency);

  // Convert annual rate to semi-annual rate
  const semiAnnualRate = annualRate / 2;

  // Calculate the effective rate per payment period
  // Formula: ((1 + r_semi)^(2/n) - 1) where n is payments per year
  const periodicRate = Math.pow(1 + semiAnnualRate, 2 / paymentsPerYear) - 1;

  return periodicRate;
}

/**
 * Calculate the payment amount for a given principal, rate, and number of payments
 */
function calculatePayment(
  principal: number,
  periodicRate: number,
  numberOfPayments: number
): number {
  if (periodicRate === 0) {
    return principal / numberOfPayments;
  }

  // Standard amortization formula: P * [r(1+r)^n] / [(1+r)^n - 1]
  const payment =
    principal *
    (periodicRate * Math.pow(1 + periodicRate, numberOfPayments)) /
    (Math.pow(1 + periodicRate, numberOfPayments) - 1);

  return payment;
}

/**
 * Get the number of payments for a time period
 */
function getPaymentCount(years: number, frequency: PaymentFrequency): number {
  return Math.round(years * getPaymentsPerYear(frequency));
}

/**
 * Get additional payment amount for a specific payment number
 */
function getAdditionalPaymentAmount(
  paymentNumber: number,
  additionalPayments: AdditionalPayment[]
): number {
  let totalAdditional = 0;

  for (const addlPmt of additionalPayments) {
    // Skip if payment is disabled (defaults to enabled if not specified)
    if (addlPmt.enabled === false) {
      continue;
    }

    if (paymentNumber < addlPmt.startPayment) {
      continue; // Haven't reached this additional payment yet
    }

    // Check if we've passed the end payment (if specified)
    if (addlPmt.endPayment && paymentNumber > addlPmt.endPayment) {
      continue;
    }

    if (addlPmt.type === 'one-time') {
      // One-time payment only applies at exact payment number
      if (paymentNumber === addlPmt.startPayment) {
        totalAdditional += addlPmt.amount;
      }
    } else if (addlPmt.type === 'recurring') {
      // Recurring payment
      const frequency = addlPmt.frequency || 1;
      const paymentsSinceStart = paymentNumber - addlPmt.startPayment;

      // Check if this payment number is on the frequency schedule
      if (paymentsSinceStart % frequency === 0) {
        totalAdditional += addlPmt.amount;
      }
    }
  }

  return totalAdditional;
}

/**
 * Get period identifier for prepayment limit tracking
 */
function getPeriodIdentifier(
  date: Date,
  startDate: Date,
  resetPeriod: 'calendar' | 'anniversary'
): string {
  if (resetPeriod === 'calendar') {
    return date.getFullYear().toString();
  } else {
    // Anniversary-based: calculate which year since mortgage start
    const monthsSinceStart =
      (date.getFullYear() - startDate.getFullYear()) * 12 +
      (date.getMonth() - startDate.getMonth());
    const anniversaryYear = Math.floor(monthsSinceStart / 12);
    return `anniversary-${anniversaryYear}`;
  }
}

/**
 * Calculate the full amortization schedule with support for changing interest rates
 */
export function calculateAmortizationSchedule(
  params: MortgageParams
): AmortizationSchedule {
  const {
    purchasePrice,
    downPaymentPercent,
    additionalFinancing,
    cmhcPstRate,
    principal,
    amortizationYears,
    paymentFrequency,
    startDate,
    renewalPeriods,
    additionalPayments,
    prepaymentLimits
  } = params;

  if (renewalPeriods.length === 0) {
    throw new Error('At least one renewal period must be specified');
  }

  // Calculate CMHC insurance details
  const insuranceDetails = calculateMortgageWithInsurance(purchasePrice, downPaymentPercent, additionalFinancing, cmhcPstRate);

  const payments: PaymentDetail[] = [];
  const totalPayments = getPaymentCount(amortizationYears, paymentFrequency);

  let balance = principal;
  let totalInterestPaid = 0;
  let totalAdditionalPayments = 0;
  let paymentNumber = 1;
  let prepaymentLimitViolations = 0;

  // Prepayment limit tracking
  let currentPeriodLumpSum = 0; // Track lump sum payments in current period
  let currentPeriodIdentifier = ''; // Track which period we're in (year or anniversary year)

  // Sort renewal periods by start payment
  const sortedPeriods = [...renewalPeriods].sort(
    (a, b) => a.startPayment - b.startPayment
  );

  // Process each renewal period
  for (let termIndex = 0; termIndex < sortedPeriods.length; termIndex++) {
    const term = sortedPeriods[termIndex];
    const nextTerm = sortedPeriods[termIndex + 1];

    // Determine how many payments in this term
    const termStartPayment = term.startPayment;
    const termEndPayment = nextTerm
      ? nextTerm.startPayment - 1
      : totalPayments;

    const paymentsInTerm = termEndPayment - termStartPayment + 1;
    const paymentsRemaining = totalPayments - paymentNumber + 1;

    // Calculate periodic rate for this term
    const periodicRate = getPeriodicRate(term.annualRate, paymentFrequency);

    // Calculate payment amount for this term
    // Payment is recalculated at each renewal based on remaining balance and amortization
    const payment = calculatePayment(balance, periodicRate, paymentsRemaining);

    // Generate payments for this term
    for (let i = 0; i < paymentsInTerm && balance > 0.01; i++) {
      const interestPayment = balance * periodicRate;
      const principalPayment = payment - interestPayment;

      // Ensure we don't overpay
      const actualPrincipalPayment = Math.min(principalPayment, balance);
      const actualPayment = actualPrincipalPayment + interestPayment;

      balance -= actualPrincipalPayment;
      totalInterestPaid += interestPayment;

      // Apply additional payments
      const additionalPayment = getAdditionalPaymentAmount(paymentNumber, additionalPayments);
      const actualAdditionalPayment = Math.min(additionalPayment, balance);
      balance -= actualAdditionalPayment;
      totalAdditionalPayments += actualAdditionalPayment;

      // Calculate payment date
      const paymentDate = new Date(startDate);
      const daysToAdd = getDaysForPayment(paymentNumber, paymentFrequency);
      paymentDate.setDate(paymentDate.getDate() + daysToAdd);

      // Check prepayment limits if enabled
      let exceedsLimit = false;
      if (prepaymentLimits && actualAdditionalPayment > 0) {
        const periodId = getPeriodIdentifier(
          paymentDate,
          startDate,
          prepaymentLimits.resetPeriod
        );

        // Reset counter if we've entered a new period
        if (periodId !== currentPeriodIdentifier) {
          currentPeriodIdentifier = periodId;
          currentPeriodLumpSum = 0;
        }

        // Add this payment's additional amount to the period total
        currentPeriodLumpSum += actualAdditionalPayment;

        // Calculate the annual lump sum limit (% of original principal)
        const annualLumpSumLimit =
          principal * (prepaymentLimits.lumpSumLimitPercent / 100);

        // Check if we've exceeded the limit
        if (currentPeriodLumpSum > annualLumpSumLimit) {
          exceedsLimit = true;
          prepaymentLimitViolations++;
        }
      }

      payments.push({
        paymentNumber,
        paymentDate,
        payment: actualPayment,
        principal: actualPrincipalPayment,
        interest: interestPayment,
        additionalPayment: actualAdditionalPayment,
        balance: Math.max(0, balance),
        interestRate: term.annualRate,
        termNumber: termIndex + 1,
        exceedsLimit: exceedsLimit || undefined, // Only include if true
      });

      paymentNumber++;

      // Break if mortgage is paid off
      if (balance < 0.01) break;
    }

    // Break if mortgage is paid off
    if (balance < 0.01) break;
  }

  // Calculate savings from additional payments
  const actualPayoffMonths = Math.round(payments.length / getPaymentsPerYear(paymentFrequency) * 12);
  const originalPayoffMonths = amortizationYears * 12;
  const timeSaved = originalPayoffMonths - actualPayoffMonths;

  // Calculate what interest would have been WITHOUT additional payments
  // Only calculate if there were actually additional payments made
  let interestSaved = 0;
  if (totalAdditionalPayments > 0) {
    // Recalculate schedule without additional payments by running through all renewal periods
    let balanceWithout = principal;
    let totalInterestWithout = 0;
    let currentPaymentNumber = 1;

    // Process each renewal period
    for (let termIndex = 0; termIndex < sortedPeriods.length && balanceWithout > 0.01; termIndex++) {
      const term = sortedPeriods[termIndex];
      const nextTerm = sortedPeriods[termIndex + 1];

      // Determine the range of payments for this term
      const termEndPayment = nextTerm ? nextTerm.startPayment - 1 : totalPayments;

      // Calculate how many payments remain in the full amortization from this point
      const paymentsRemaining = totalPayments - currentPaymentNumber + 1;

      const periodicRate = getPeriodicRate(term.annualRate, paymentFrequency);
      const payment = calculatePayment(balanceWithout, periodicRate, paymentsRemaining);

      // Make payments for this term
      while (currentPaymentNumber <= termEndPayment && balanceWithout > 0.01 && currentPaymentNumber <= totalPayments) {
        const interestPayment = balanceWithout * periodicRate;
        const principalPayment = payment - interestPayment;
        const actualPrincipalPayment = Math.min(principalPayment, balanceWithout);

        balanceWithout -= actualPrincipalPayment;
        totalInterestWithout += interestPayment;
        currentPaymentNumber++;
      }
    }

    interestSaved = Math.max(0, totalInterestWithout - totalInterestPaid);
  }

  return {
    payments,
    totalInterest: totalInterestPaid,
    totalPrincipal: principal,
    totalPayments: payments.reduce((sum, p) => sum + p.payment, 0),
    summary: {
      purchasePrice,
      downPayment: insuranceDetails.downPayment,
      downPaymentPercent,
      mortgageAmount: insuranceDetails.mortgageAmount,
      cmhcInsurance: insuranceDetails.cmhcInsurance,
      cmhcPremiumRate: insuranceDetails.cmhcPremiumRate,
      cmhcPst: insuranceDetails.cmhcPst,
      cmhcPstRate: insuranceDetails.cmhcPstRate,
      additionalFinancing: insuranceDetails.additionalFinancing,
      originalPrincipal: principal,
      totalInterestPaid,
      totalPaid: principal + totalInterestPaid,
      totalAdditionalPayments,
      interestSaved,
      timeSaved,
      amortizationYears,
      actualPayoffMonths,
      paymentFrequency,
      prepaymentLimitViolations: prepaymentLimits ? prepaymentLimitViolations : undefined,
    },
  };
}

/**
 * Calculate the number of days from start for a given payment number
 */
function getDaysForPayment(paymentNumber: number, frequency: PaymentFrequency): number {
  switch (frequency) {
    case 'monthly':
      // Approximate: 30.44 days per month on average
      return Math.round((paymentNumber - 1) * 30.44);
    case 'bi-weekly':
    case 'accelerated-bi-weekly':
      return (paymentNumber - 1) * 14;
    case 'weekly':
      return (paymentNumber - 1) * 7;
  }
}

/**
 * Export schedule to CSV format
 */
export function exportToCSV(schedule: AmortizationSchedule): string {
  const headers = [
    'Payment #',
    'Date',
    'Payment',
    'Principal',
    'Interest',
    'Additional Payment',
    'Balance',
    'Interest Rate',
    'Term',
  ];

  const rows = schedule.payments.map((p) => [
    p.paymentNumber.toString(),
    p.paymentDate.toISOString().split('T')[0],
    p.payment.toFixed(2),
    p.principal.toFixed(2),
    p.interest.toFixed(2),
    p.additionalPayment.toFixed(2),
    p.balance.toFixed(2),
    (p.interestRate * 100).toFixed(3) + '%',
    p.termNumber.toString(),
  ]);

  const csvContent = [headers, ...rows]
    .map((row) => row.join(','))
    .join('\n');

  return csvContent;
}

/**
 * Download CSV file
 */
export function downloadCSV(schedule: AmortizationSchedule, filename: string = 'amortization-schedule.csv'): void {
  const csv = exportToCSV(schedule);
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
}

/**
 * Get schedule as JSON
 */
export function exportToJSON(schedule: AmortizationSchedule): string {
  return JSON.stringify(schedule, null, 2);
}
