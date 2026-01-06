# Canadian Mortgage Amortizer

A web application for calculating Canadian mortgage amortization schedules with support for changing interest rates at different renewal periods.

## Features

- **Canadian Mortgage Calculations**: Uses semi-annual compounding (not monthly like US mortgages)
- **CMHC Insurance Support**: Automatic calculation of mortgage default insurance for down payments < 20%
  - 5-9.99% down: 4.00% premium
  - 10-14.99% down: 3.10% premium
  - 15-19.99% down: 2.80% premium
  - 20%+ down: No insurance required
- **Flexible Payment Scheduling**:
  - Set custom start date for first payment
  - Multiple payment frequencies: monthly, bi-weekly, weekly, and accelerated bi-weekly
- **Multiple Renewal Periods**: Support for different interest rates across multiple terms
- **Interactive Display**: View complete payment schedules with principal, interest, and balance breakdown
- **Multiple Export Formats**:
  - CSV for spreadsheet analysis
  - PDF for professional reports
  - JSON for API/programmatic access

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open your browser to `http://localhost:5173`

### Build for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

## How It Works

### Canadian Mortgage Specifics

Canadian mortgages differ from US mortgages in a key way: interest is compounded **semi-annually**, not monthly. This application correctly implements the Canadian mortgage calculation formula:

1. Convert annual rate to semi-annual rate: `r_semi = annual_rate / 2`
2. Calculate periodic rate: `r_periodic = (1 + r_semi)^(2/n) - 1` where n is payments per year
3. Apply standard amortization formula with the periodic rate

### CMHC Insurance

In Canada, mortgage default insurance (CMHC, Sagen, or Canada Guaranty) is required when the down payment is less than 20%. The insurance premium is calculated as a percentage of the mortgage amount and is typically added to the principal (capitalized). This application automatically:

- Calculates the applicable premium rate based on down payment percentage
- Adds the premium to the mortgage principal
- Displays the insurance cost separately in the summary

### Additional Financing

Sometimes lenders approve additional funds beyond the purchase price for things like:
- Home repairs or renovations (e.g., electrical work, roof repairs)
- Appliances or furniture
- Closing cost coverage

This application supports additional financing:
- Enter any extra amount the lender has approved
- Additional financing is added after CMHC insurance calculation
- The total principal includes: Mortgage Amount + CMHC Insurance + Additional Financing
- Down payment percentage is calculated only on the purchase price (not the additional financing)

### Renewal Periods

Canadian mortgages typically have terms of 1-5 years, after which they must be renewed at current market rates. This application allows you to:

- Define multiple renewal periods with different interest rates
- Specify when each term starts (by payment number)
- See how rate changes affect your payment schedule

## Usage Example

1. Enter the home purchase price (e.g., $625,000)
2. Enter your down payment percentage (e.g., 10%)
   - The app will automatically calculate CMHC insurance if applicable
3. Enter any additional financing (e.g., $7,500 for electrical work)
   - Leave at $0 if you don't have additional financing
4. Set the first payment date
5. Set the amortization period (e.g., 25 years)
6. Choose your payment frequency (e.g., Monthly)
7. Define renewal periods:
   - **Term 1**: Start at payment 1, 5.49% annual rate, 5 year term
   - **Term 2**: Start at payment 61, 4.99% annual rate, 5 year term
   - And so on...
8. Click "Calculate Schedule" to see results
9. Export to CSV, PDF, or JSON as needed

## Technology Stack

- **Frontend**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **PDF Generation**: jsPDF with autoTable
- **Development**: ESLint, TypeScript strict mode

## License

MIT
