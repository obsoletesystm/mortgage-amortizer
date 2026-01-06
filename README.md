# Canadian Mortgage Amortization Calculator

A comprehensive web application for calculating Canadian mortgage amortization schedules with advanced features including multiple renewal periods, additional payments, and prepayment limit tracking.

**🚀 [Live Demo](https://obsoletesystm.github.io/mortgage-amortizer/)**

## Features

### Core Calculations
- **Canadian Mortgage Calculations**: Uses semi-annual compounding (not monthly like US mortgages)
- **CMHC Insurance Support**: Automatic calculation of mortgage default insurance for down payments < 20%
  - 5-9.99% down: 4.00% premium
  - 10-14.99% down: 3.10% premium
  - 15-19.99% down: 2.80% premium
  - 20%+ down: No insurance required
- **Provincial PST on CMHC**: Support for provinces that charge PST on insurance premiums

### Payment Options
- **Flexible Payment Scheduling**:
  - Multiple payment frequencies: monthly, bi-weekly, weekly, and accelerated bi-weekly
  - Custom start date for first payment
- **Multiple Renewal Periods**: Model different interest rates across multiple mortgage terms
- **Additional Payments**:
  - One-time lump sum payments
  - Recurring additional payments (e.g., annual, quarterly, monthly)
  - Enable/disable payments to compare different scenarios
  - Start and end payment scheduling

### Prepayment Limit Tracking
- **Contractual Limit Validation**: Track prepayment privileges to avoid penalties
  - Annual lump sum limits (% of original principal)
  - Payment increase limits
  - Calendar year or mortgage anniversary reset periods
- **Visual Warnings**: Payments exceeding limits are highlighted with warning indicators
- **Violation Tracking**: Summary shows total payments that exceed contractual limits

### Data Management
- **Save & Load Profiles**: Store multiple mortgage scenarios in browser localStorage
- **URL Sharing**: Share specific calculations via URL parameters
- **Profile Management**: Update existing profiles or create new ones

### Export & Analysis
- **Interactive Display**: Complete payment schedule with principal, interest, and balance breakdown
- **Interest & Time Savings**: Calculate savings from additional payments
- **Multiple Export Formats**:
  - CSV for spreadsheet analysis
  - PDF for professional reports
  - JSON for API/programmatic access

## Getting Started

### Live Demo
Visit **[https://obsoletesystm.github.io/mortgage-amortizer/](https://obsoletesystm.github.io/mortgage-amortizer/)** to use the calculator immediately.

### Local Development

#### Installation
```bash
npm install
```

#### Development Server
```bash
npm run dev
```

Open your browser to `http://localhost:5173`

#### Build for Production
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
- Supports provincial PST on insurance premiums (Quebec, Saskatchewan, Manitoba, Ontario)
- Displays the insurance cost separately in the summary

### Additional Financing

Sometimes lenders approve additional funds beyond the purchase price for things like:
- Home repairs or renovations (e.g., electrical work, roof repairs)
- Appliances or furniture
- Closing cost coverage

This application supports additional financing:
- Enter any extra amount the lender has approved
- Additional financing is added after CMHC insurance calculation
- The total principal includes: Mortgage Amount + CMHC Insurance + PST + Additional Financing
- Down payment percentage is calculated only on the purchase price (not the additional financing)

### Renewal Periods

Canadian mortgages typically have terms of 1-5 years, after which they must be renewed at current market rates. This application allows you to:

- Define multiple renewal periods with different interest rates
- Specify when each term starts (by payment number)
- See how rate changes affect your payment schedule
- Payments are recalculated at each renewal based on remaining balance and time

### Additional Payments

Plan prepayments to reduce interest costs and pay off your mortgage faster:
- **One-time payments**: Lump sum payments at specific times
- **Recurring payments**: Regular additional payments (e.g., $500 every month)
- **Flexible scheduling**: Set start and end payment numbers for each additional payment
- **Enable/disable toggle**: Compare scenarios by turning payments on/off
- **Savings calculation**: See exactly how much interest and time you save

### Prepayment Limits

Most Canadian mortgages have contractual limits on prepayments:
- **Annual lump sum limit**: Typically 10-20% of original principal per year
- **Payment increase limit**: Typically 10-20% increase in regular payment amount
- **Reset periods**: Limits reset either on calendar year (Jan 1) or mortgage anniversary

The calculator tracks these limits and warns you when payments exceed them, helping you maximize prepayments while staying within your mortgage terms.

## Usage Example

### Basic Calculation

1. **Enter property details:**
   - Purchase price: $625,000
   - Down payment: 10%
   - Additional financing: $7,500 (for renovations)
   - CMHC PST rate: 8% (if in Ontario)

2. **Set mortgage terms:**
   - Amortization: 25 years
   - Payment frequency: Monthly
   - Start date: Select your first payment date

3. **Define renewal periods:**
   - **Term 1**: Payment 1, 5.49% annual rate, 5 year term
   - **Term 2**: Payment 61, 4.99% annual rate, 5 year term
   - **Term 3**: Payment 121, 4.19% annual rate, 5 year term

4. **Add prepayments (optional):**
   - One-time: $10,000 at payment 12
   - Recurring: $500 every 12 payments (annual) starting at payment 13

5. **Configure prepayment limits (optional):**
   - Enable limits
   - Annual lump sum: 15% of principal
   - Reset period: Mortgage anniversary

6. **Calculate and export:**
   - Click "Calculate Schedule"
   - Review the complete amortization table
   - Export to CSV, PDF, or save as a profile

### Saving and Sharing

- **Save Profile**: Click "Save Profile" to store the calculation in your browser
- **Load Profile**: Select from saved profiles dropdown
- **Share via URL**: The URL updates with your calculation parameters - share the link with others

## Technology Stack

- **Frontend**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **PDF Generation**: jsPDF with autoTable
- **Storage**: Browser localStorage API
- **Deployment**: GitHub Actions → GitHub Pages

## Project Structure

```
mortgage-amortizer/
├── src/
│   ├── App.tsx                 # Main application component
│   ├── main.tsx                # Application entry point
│   ├── index.css               # Global styles
│   ├── lib/
│   │   ├── mortgage.ts         # Mortgage calculation engine
│   │   ├── pdfExport.ts        # PDF generation logic
│   │   └── storage.ts          # localStorage management
│   └── types/
│       └── mortgage.ts         # TypeScript type definitions
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Pages deployment
└── vite.config.ts              # Vite configuration
```

## Browser Compatibility

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

Requires support for ES6+, localStorage, and modern CSS features.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

MIT

## Acknowledgments

- Built with [Claude Code](https://claude.com/claude-code)
- Calculations based on Canadian mortgage standards and CMHC guidelines
- Interest calculations use Canadian semi-annual compounding methodology

---

**Note**: This calculator is for informational purposes only. Actual mortgage terms, rates, and calculations may vary. Always consult with a licensed mortgage professional for accurate mortgage advice.
