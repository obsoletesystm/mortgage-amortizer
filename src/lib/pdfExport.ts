import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { AmortizationSchedule } from '../types/mortgage';

/**
 * Generate and download a PDF report of the amortization schedule
 */
export function exportToPDF(
  schedule: AmortizationSchedule,
  filename: string = 'mortgage-amortization-schedule.pdf'
): void {
  const doc = new jsPDF();

  // Title
  doc.setFontSize(18);
  doc.text('Canadian Mortgage Amortization Schedule', 14, 20);

  // Summary information
  doc.setFontSize(12);
  doc.text('Purchase Details', 14, 35);
  doc.setFontSize(10);

  const purchaseDetails = [
    `Purchase Price: $${schedule.summary.purchasePrice.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    `Down Payment (${schedule.summary.downPaymentPercent}%): $${schedule.summary.downPayment.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    `Mortgage Amount: $${schedule.summary.mortgageAmount.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  ];

  if (schedule.summary.cmhcInsurance > 0) {
    purchaseDetails.push(
      `CMHC Insurance (${(schedule.summary.cmhcPremiumRate * 100).toFixed(2)}%): $${schedule.summary.cmhcInsurance.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    );
  }

  if (schedule.summary.cmhcPst > 0) {
    purchaseDetails.push(
      `PST on CMHC (${(schedule.summary.cmhcPstRate * 100).toFixed(2)}%): $${schedule.summary.cmhcPst.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    );
  }

  if (schedule.summary.additionalFinancing > 0) {
    purchaseDetails.push(
      `Additional Financing: $${schedule.summary.additionalFinancing.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    );
  }

  purchaseDetails.push(
    `Total Principal: $${schedule.summary.originalPrincipal.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  );

  let yPosition = 42;
  purchaseDetails.forEach((line) => {
    doc.text(line, 14, yPosition);
    yPosition += 6;
  });

  yPosition += 4;
  doc.setFontSize(12);
  doc.text('Payment Summary', 14, yPosition);
  yPosition += 7;
  doc.setFontSize(10);

  const paymentSummary = [
    `Total Interest Paid: $${schedule.summary.totalInterestPaid.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    `Total Amount Paid: $${schedule.summary.totalPaid.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    `Amortization Period: ${schedule.summary.amortizationYears} years`,
    `Payment Frequency: ${formatFrequency(schedule.summary.paymentFrequency)}`,
    `Total Payments: ${schedule.payments.length}`,
    `First Payment Date: ${schedule.payments[0]?.paymentDate.toISOString().split('T')[0]}`,
  ];

  paymentSummary.forEach((line) => {
    doc.text(line, 14, yPosition);
    yPosition += 6;
  });

  // Additional payment savings (if applicable)
  if (schedule.summary.totalAdditionalPayments > 0) {
    yPosition += 4;
    doc.setFontSize(12);
    doc.text('Additional Payment Savings', 14, yPosition);
    yPosition += 7;
    doc.setFontSize(10);

    const savingsSummary = [
      `Total Additional Payments: $${schedule.summary.totalAdditionalPayments.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `Interest Saved: $${schedule.summary.interestSaved.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `Time Saved: ${Math.round(schedule.summary.timeSaved)} months`,
      `Actual Payoff: ${schedule.summary.actualPayoffMonths} months`,
    ];

    savingsSummary.forEach((line) => {
      doc.text(line, 14, yPosition);
      yPosition += 6;
    });
  }

  // Payment schedule table
  const tableData = schedule.payments.map((p) => [
    p.paymentNumber,
    p.paymentDate.toISOString().split('T')[0],
    `$${p.payment.toFixed(2)}`,
    `$${p.principal.toFixed(2)}`,
    `$${p.interest.toFixed(2)}`,
    p.additionalPayment > 0 ? `$${p.additionalPayment.toFixed(2)}` : '-',
    `$${p.balance.toFixed(2)}`,
    `${(p.interestRate * 100).toFixed(3)}%`,
    p.termNumber,
  ]);

  autoTable(doc, {
    startY: yPosition + 5,
    head: [
      ['#', 'Date', 'Payment', 'Principal', 'Interest', 'Additional', 'Balance', 'Rate', 'Term'],
    ],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [66, 139, 202] },
    styles: { fontSize: 7 },
    columnStyles: {
      0: { cellWidth: 12 },
      1: { cellWidth: 22 },
      2: { cellWidth: 20, halign: 'right' },
      3: { cellWidth: 20, halign: 'right' },
      4: { cellWidth: 20, halign: 'right' },
      5: { cellWidth: 20, halign: 'right' },
      6: { cellWidth: 22, halign: 'right' },
      7: { cellWidth: 16, halign: 'right' },
      8: { cellWidth: 11, halign: 'center' },
    },
  });

  // Add footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(
      `Page ${i} of ${pageCount}`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  // Save the PDF
  doc.save(filename);
}

function formatFrequency(frequency: string): string {
  switch (frequency) {
    case 'monthly':
      return 'Monthly';
    case 'bi-weekly':
      return 'Bi-Weekly';
    case 'accelerated-bi-weekly':
      return 'Accelerated Bi-Weekly';
    case 'weekly':
      return 'Weekly';
    default:
      return frequency;
  }
}
