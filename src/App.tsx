import { useState, useMemo, useEffect } from 'react';
import type { MortgageParams, RenewalPeriod, AdditionalPayment, PrepaymentLimits, AmortizationSchedule } from './types/mortgage';
import { calculateAmortizationSchedule, calculateMortgageWithInsurance, downloadCSV, exportToJSON } from './lib/mortgage';
import { exportToPDF } from './lib/pdfExport';
import { getProfiles, saveProfile, updateProfile, deleteProfile, type MortgageProfile } from './lib/storage';

function App() {
  const [purchasePrice, setPurchasePrice] = useState<number>(500000);
  const [downPaymentPercent, setDownPaymentPercent] = useState<number>(20);
  const [additionalFinancing, setAdditionalFinancing] = useState<number>(0);
  const [cmhcPstRate, setCmhcPstRate] = useState<number>(0);
  const [amortizationYears, setAmortizationYears] = useState<number>(25);
  const [paymentFrequency, setPaymentFrequency] = useState<'monthly' | 'bi-weekly' | 'weekly' | 'accelerated-bi-weekly'>('monthly');
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [renewalPeriods, setRenewalPeriods] = useState<RenewalPeriod[]>([
    { startPayment: 1, annualRate: 0.05, termYears: 5 },
  ]);
  const [additionalPayments, setAdditionalPayments] = useState<AdditionalPayment[]>([]);
  const [enablePrepaymentLimits, setEnablePrepaymentLimits] = useState<boolean>(false);
  const [prepaymentLimits, setPrepaymentLimits] = useState<PrepaymentLimits>({
    lumpSumLimitPercent: 15,
    paymentIncreaseLimitPercent: 15,
    resetPeriod: 'anniversary',
  });
  const [schedule, setSchedule] = useState<AmortizationSchedule | null>(null);

  // UI state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // Profile management
  const [savedProfiles, setSavedProfiles] = useState<MortgageProfile[]>([]);
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState<boolean>(false);
  const [profileName, setProfileName] = useState<string>('');

  // Load profiles on mount
  useEffect(() => {
    setSavedProfiles(getProfiles());
  }, []);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMobileMenuOpen]);

  // Load profile from URL parameter on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const profileId = urlParams.get('profile');

    if (profileId) {
      const profile = getProfiles().find(p => p.id === profileId);
      if (profile) {
        handleLoadProfile(profileId);
      } else {
        // Profile not found, remove the parameter
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update URL when profile changes
  useEffect(() => {
    if (currentProfileId) {
      const url = new URL(window.location.href);
      url.searchParams.set('profile', currentProfileId);
      window.history.replaceState({}, '', url.toString());
    } else {
      const url = new URL(window.location.href);
      url.searchParams.delete('profile');
      window.history.replaceState({}, '', url.toString());
    }
  }, [currentProfileId]);

  // Calculate mortgage details including CMHC insurance and PST
  const mortgageDetails = useMemo(() => {
    try {
      return calculateMortgageWithInsurance(purchasePrice, downPaymentPercent, additionalFinancing, cmhcPstRate);
    } catch (error) {
      return null;
    }
  }, [purchasePrice, downPaymentPercent, additionalFinancing, cmhcPstRate]);

  const handleAddRenewalPeriod = () => {
    const lastPeriod = renewalPeriods[renewalPeriods.length - 1];
    const paymentsPerYear = paymentFrequency === 'monthly' ? 12 : paymentFrequency === 'weekly' ? 52 : 26;
    const nextStartPayment = lastPeriod.startPayment + Math.round(lastPeriod.termYears * paymentsPerYear);

    setRenewalPeriods([
      ...renewalPeriods,
      { startPayment: nextStartPayment, annualRate: 0.0549, termYears: 5 },
    ]);
  };

  const handleRemoveRenewalPeriod = (index: number) => {
    if (renewalPeriods.length > 1) {
      setRenewalPeriods(renewalPeriods.filter((_, i) => i !== index));
    }
  };

  const handleUpdateRenewalPeriod = (index: number, field: keyof RenewalPeriod, value: number) => {
    const updated = [...renewalPeriods];
    updated[index] = { ...updated[index], [field]: value };
    setRenewalPeriods(updated);
  };

  const handleAddAdditionalPayment = () => {
    setAdditionalPayments([
      ...additionalPayments,
      { type: 'one-time', amount: 100, startPayment: 1, enabled: true },
    ]);
  };

  const handleRemoveAdditionalPayment = (index: number) => {
    setAdditionalPayments(additionalPayments.filter((_, i) => i !== index));
  };

  const handleUpdateAdditionalPayment = (index: number, field: string, value: any) => {
    const updated = [...additionalPayments];
    updated[index] = { ...updated[index], [field]: value };
    setAdditionalPayments(updated);
  };

  const handleSaveProfile = (saveAsNew: boolean = false) => {
    if (!profileName.trim()) {
      alert('Please enter a profile name');
      return;
    }

    const profileData = {
      purchasePrice,
      downPaymentPercent,
      additionalFinancing,
      cmhcPstRate,
      amortizationYears,
      paymentFrequency,
      startDate,
      renewalPeriods,
      additionalPayments,
      prepaymentLimits: enablePrepaymentLimits ? prepaymentLimits : undefined,
    };

    let profile: MortgageProfile;

    if (currentProfileId && !saveAsNew) {
      // Update existing profile
      const updated = updateProfile(currentProfileId, {
        name: profileName,
        data: profileData,
      });
      profile = updated!;
    } else {
      // Create new profile
      profile = saveProfile({
        name: profileName,
        data: profileData,
      });
    }

    setSavedProfiles(getProfiles());
    setCurrentProfileId(profile.id);
    setProfileName('');
    setShowSaveDialog(false);
  };

  const handleLoadProfile = (profileId: string) => {
    const profile = savedProfiles.find(p => p.id === profileId);
    if (!profile) return;

    setPurchasePrice(profile.data.purchasePrice);
    setDownPaymentPercent(profile.data.downPaymentPercent);
    setAdditionalFinancing(profile.data.additionalFinancing);
    setCmhcPstRate(profile.data.cmhcPstRate);
    setAmortizationYears(profile.data.amortizationYears);
    setPaymentFrequency(profile.data.paymentFrequency);
    setStartDate(profile.data.startDate);
    setRenewalPeriods(profile.data.renewalPeriods);
    setAdditionalPayments(profile.data.additionalPayments);
    if (profile.data.prepaymentLimits) {
      setPrepaymentLimits(profile.data.prepaymentLimits);
      setEnablePrepaymentLimits(true);
    } else {
      setEnablePrepaymentLimits(false);
    }
    setCurrentProfileId(profileId);
  };

  const handleDeleteProfile = (profileId: string) => {
    if (confirm('Are you sure you want to delete this profile?')) {
      deleteProfile(profileId);
      setSavedProfiles(getProfiles());
      if (currentProfileId === profileId) {
        setCurrentProfileId(null);
      }
    }
  };

  const handleClearProfile = () => {
    setCurrentProfileId(null);
  };

  const handleOpenSaveDialog = () => {
    // Pre-fill the name if updating an existing profile
    if (currentProfileId) {
      const profile = savedProfiles.find(p => p.id === currentProfileId);
      if (profile) {
        setProfileName(profile.name);
      }
    }
    setShowSaveDialog(true);
  };

  const handleShareProfile = () => {
    if (!currentProfileId) {
      alert('Please load or save a profile first');
      return;
    }

    const url = new URL(window.location.href);
    url.searchParams.set('profile', currentProfileId);

    navigator.clipboard.writeText(url.toString()).then(() => {
      alert('Profile URL copied to clipboard!');
    }).catch(() => {
      alert('Failed to copy URL. Your profile URL is:\n' + url.toString());
    });
  };

  const handleCalculate = () => {
    if (!mortgageDetails) {
      alert('Please check your down payment percentage (minimum 5%)');
      return;
    }

    const params: MortgageParams = {
      purchasePrice,
      downPaymentPercent,
      additionalFinancing,
      cmhcPstRate,
      principal: mortgageDetails.totalPrincipal,
      amortizationYears,
      paymentFrequency,
      startDate: new Date(startDate),
      renewalPeriods,
      additionalPayments,
      prepaymentLimits: enablePrepaymentLimits ? prepaymentLimits : undefined,
    };

    const result = calculateAmortizationSchedule(params);
    setSchedule(result);

    // Close mobile menu after calculating to show results
    setIsMobileMenuOpen(false);
  };

  const handleExportCSV = () => {
    if (schedule) {
      downloadCSV(schedule);
    }
  };

  const handleExportPDF = () => {
    if (schedule) {
      exportToPDF(schedule);
    }
  };

  const handleExportJSON = () => {
    if (schedule) {
      const json = exportToJSON(schedule);
      const blob = new Blob([json], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'amortization-schedule.json';
      link.click();
      window.URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      {/* Mobile Topbar - Sticky on mobile, static on desktop */}
      <div className="sticky top-0 z-30 bg-gray-900 lg:static lg:bg-transparent">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-3 lg:py-0 lg:mb-2 border-b border-gray-800 lg:border-0">
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-2xl lg:text-4xl font-bold text-blue-400 truncate">
                Canadian Mortgage Amortizer
              </h1>
              <p className="hidden lg:block text-gray-400 mt-2 mb-8">
                Calculate amortization schedules with semi-annual compounding and multiple renewal periods
              </p>
            </div>

            {/* Hamburger Menu Button - Mobile Only */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden flex-shrink-0 p-2 ml-3 rounded-lg bg-gray-800 hover:bg-gray-700 active:bg-gray-600 touch-manipulation"
              aria-label="Open menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-0">

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Input Panel - Slides in on mobile */}
          <div className={`
            fixed lg:static inset-y-0 left-0 z-50 lg:z-auto
            w-80 lg:w-auto lg:col-span-1
            bg-gray-800 rounded-none lg:rounded-lg p-4 sm:p-6 shadow-lg
            transform transition-transform duration-300 ease-in-out lg:transform-none
            overflow-y-auto lg:overflow-visible
            ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          `}>
            {/* Close button - Mobile only */}
            <div className="flex items-center justify-between mb-4 lg:hidden">
              <h2 className="text-xl font-semibold text-blue-300">Mortgage Details</h2>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 rounded-lg hover:bg-gray-700 active:bg-gray-600 touch-manipulation"
                aria-label="Close menu"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <h2 className="hidden lg:block text-xl sm:text-2xl font-semibold mb-4 text-blue-300">Mortgage Details</h2>

            {/* Profile Management */}
            <div className="mb-6 p-3 sm:p-4 bg-gray-700 rounded">
              <div className="flex flex-col sm:flex-row gap-2 mb-3">
                <button
                  onClick={handleOpenSaveDialog}
                  className="flex-1 px-4 py-3 sm:py-2 bg-green-600 hover:bg-green-700 active:bg-green-800 rounded text-sm font-medium touch-manipulation"
                >
                  {currentProfileId ? 'Update Profile' : 'Save Profile'}
                </button>
                {savedProfiles.length > 0 && (
                  <select
                    onChange={(e) => e.target.value && handleLoadProfile(e.target.value)}
                    value=""
                    className="flex-1 px-4 py-3 sm:py-2 bg-gray-600 border border-gray-500 rounded text-sm touch-manipulation"
                  >
                    <option value="">Load Profile...</option>
                    {savedProfiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {currentProfileId && (
                <div className="space-y-2">
                  <div className="text-xs text-green-400 flex items-center gap-1">
                    <span>✓</span>
                    <span>Loaded: {savedProfiles.find(p => p.id === currentProfileId)?.name}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleShareProfile}
                      className="flex-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
                    >
                      Share URL
                    </button>
                    <button
                      onClick={handleClearProfile}
                      className="flex-1 px-2 py-1 bg-gray-600 hover:bg-gray-700 rounded text-xs"
                    >
                      Clear Profile
                    </button>
                  </div>
                </div>
              )}

              {savedProfiles.length > 0 && (
                <details className="mt-3">
                  <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-300">
                    Manage Profiles ({savedProfiles.length})
                  </summary>
                  <div className="mt-2 space-y-1">
                    {savedProfiles.map((profile) => (
                      <div key={profile.id} className="flex justify-between items-center p-2 bg-gray-600 rounded text-xs">
                        <div className="flex-1 truncate">
                          <div className="font-medium">{profile.name}</div>
                          <div className="text-gray-400 text-[10px]">
                            {new Date(profile.updatedAt).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleLoadProfile(profile.id)}
                            className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded"
                          >
                            Load
                          </button>
                          <button
                            onClick={() => handleDeleteProfile(profile.id)}
                            className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Purchase Price ($)</label>
                <input
                  type="number"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Down Payment (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min="5"
                  max="100"
                  value={downPaymentPercent}
                  onChange={(e) => setDownPaymentPercent(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {downPaymentPercent < 20 && (
                  <p className="text-xs text-yellow-400 mt-1">CMHC insurance required (&lt;20% down)</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Additional Financing ($)</label>
                <input
                  type="number"
                  step="100"
                  min="0"
                  value={additionalFinancing}
                  onChange={(e) => setAdditionalFinancing(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">Extra funds (e.g., renovations, repairs)</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">PST on CMHC Insurance (%)</label>
                <select
                  value={(cmhcPstRate * 100).toString()}
                  onChange={(e) => setCmhcPstRate(Number(e.target.value) / 100)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="0">None (0%)</option>
                  <option value="6">Saskatchewan (6%)</option>
                  <option value="7">Manitoba (7%)</option>
                  <option value="8">Ontario (8%)</option>
                  <option value="9.975">Quebec (9.975%)</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">Some provinces charge PST on CMHC premiums</p>
              </div>

              {mortgageDetails && (
                <div className="p-3 bg-gray-700 rounded text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Down Payment:</span>
                    <span className="font-medium">${mortgageDetails.downPayment.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Mortgage Amount:</span>
                    <span className="font-medium">${mortgageDetails.mortgageAmount.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</span>
                  </div>
                  {mortgageDetails.cmhcInsurance > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">CMHC Insurance ({(mortgageDetails.cmhcPremiumRate * 100).toFixed(2)}%):</span>
                      <span className="font-medium text-yellow-400">${mortgageDetails.cmhcInsurance.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  {mortgageDetails.cmhcPst > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">PST on CMHC ({(mortgageDetails.cmhcPstRate * 100).toFixed(2)}%):</span>
                      <span className="font-medium text-orange-400">${mortgageDetails.cmhcPst.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  {mortgageDetails.additionalFinancing > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Additional Financing:</span>
                      <span className="font-medium text-blue-400">${mortgageDetails.additionalFinancing.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-1 border-t border-gray-600">
                    <span className="text-gray-300">Total Principal:</span>
                    <span className="font-semibold">${mortgageDetails.totalPrincipal.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">First Payment Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Amortization Period (years)</label>
                <input
                  type="number"
                  value={amortizationYears}
                  onChange={(e) => setAmortizationYears(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Payment Frequency</label>
                <select
                  value={paymentFrequency}
                  onChange={(e) => setPaymentFrequency(e.target.value as any)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="monthly">Monthly</option>
                  <option value="bi-weekly">Bi-Weekly</option>
                  <option value="accelerated-bi-weekly">Accelerated Bi-Weekly</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>

              <div className="pt-4 border-t border-gray-700">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-lg font-semibold text-blue-300">Renewal Periods</h3>
                  <button
                    onClick={handleAddRenewalPeriod}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
                  >
                    + Add Period
                  </button>
                </div>

                {renewalPeriods.map((period, index) => (
                  <div key={index} className="mb-4 p-3 bg-gray-700 rounded">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Term {index + 1}</span>
                      {renewalPeriods.length > 1 && (
                        <button
                          onClick={() => handleRemoveRenewalPeriod(index)}
                          className="text-red-400 hover:text-red-300 text-sm"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div>
                        <label className="block text-xs mb-1">Start Payment #</label>
                        <input
                          type="number"
                          value={period.startPayment}
                          onChange={(e) => handleUpdateRenewalPeriod(index, 'startPayment', Number(e.target.value))}
                          className="w-full px-2 py-1 bg-gray-600 border border-gray-500 rounded text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-xs mb-1">Annual Interest Rate (%)</label>
                        <input
                          type="number"
                          step="0.001"
                          value={(period.annualRate * 100).toFixed(3)}
                          onChange={(e) => handleUpdateRenewalPeriod(index, 'annualRate', Number(e.target.value) / 100)}
                          className="w-full px-2 py-1 bg-gray-600 border border-gray-500 rounded text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-xs mb-1">Term Length (years)</label>
                        <input
                          type="number"
                          value={period.termYears}
                          onChange={(e) => handleUpdateRenewalPeriod(index, 'termYears', Number(e.target.value))}
                          className="w-full px-2 py-1 bg-gray-600 border border-gray-500 rounded text-sm"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-gray-700">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-lg font-semibold text-blue-300">Additional Payments</h3>
                  <button
                    onClick={handleAddAdditionalPayment}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
                  >
                    + Add Payment
                  </button>
                </div>

                {additionalPayments.length === 0 && (
                  <p className="text-sm text-gray-400 mb-2">No additional payments configured</p>
                )}

                {additionalPayments.map((payment, index) => (
                  <div key={index} className={`mb-4 p-3 rounded ${payment.enabled === false ? 'bg-gray-700/50 opacity-60' : 'bg-gray-700'}`}>
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={payment.enabled !== false}
                            onChange={(e) => handleUpdateAdditionalPayment(index, 'enabled', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                        <span className="text-sm font-medium">Payment {index + 1}</span>
                        {payment.enabled === false && <span className="text-xs text-gray-400">(Disabled)</span>}
                      </div>
                      <button
                        onClick={() => handleRemoveAdditionalPayment(index)}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <label className="block text-xs mb-1">Type</label>
                        <select
                          value={payment.type}
                          onChange={(e) => handleUpdateAdditionalPayment(index, 'type', e.target.value)}
                          className="w-full px-2 py-1 bg-gray-600 border border-gray-500 rounded text-sm"
                        >
                          <option value="one-time">One-Time</option>
                          <option value="recurring">Recurring</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs mb-1">Amount ($)</label>
                        <input
                          type="number"
                          step="10"
                          value={payment.amount}
                          onChange={(e) => handleUpdateAdditionalPayment(index, 'amount', Number(e.target.value))}
                          className="w-full px-2 py-1 bg-gray-600 border border-gray-500 rounded text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-xs mb-1">Start Payment #</label>
                        <input
                          type="number"
                          min="1"
                          value={payment.startPayment}
                          onChange={(e) => handleUpdateAdditionalPayment(index, 'startPayment', Number(e.target.value))}
                          className="w-full px-2 py-1 bg-gray-600 border border-gray-500 rounded text-sm"
                        />
                      </div>

                      {payment.type === 'recurring' && (
                        <>
                          <div>
                            <label className="block text-xs mb-1">End Payment # (optional)</label>
                            <input
                              type="number"
                              min={payment.startPayment || 1}
                              value={payment.endPayment || ''}
                              onChange={(e) => handleUpdateAdditionalPayment(index, 'endPayment', e.target.value ? Number(e.target.value) : undefined)}
                              placeholder="Leave blank for no end"
                              className="w-full px-2 py-1 bg-gray-600 border border-gray-500 rounded text-sm"
                            />
                            <p className="text-xs text-gray-400 mt-1">
                              {payment.endPayment ? `Applies from payment ${payment.startPayment} to ${payment.endPayment}` : 'No end limit'}
                            </p>
                          </div>

                          <div>
                            <label className="block text-xs mb-1">Frequency (every X payments)</label>
                            <input
                              type="number"
                              min="1"
                              value={payment.frequency || 1}
                              onChange={(e) => handleUpdateAdditionalPayment(index, 'frequency', Number(e.target.value))}
                              className="w-full px-2 py-1 bg-gray-600 border border-gray-500 rounded text-sm"
                            />
                            <p className="text-xs text-gray-400 mt-1">
                              {payment.frequency === 1 ? 'Every payment' : payment.frequency === 12 && paymentFrequency === 'monthly' ? 'Annually' : `Every ${payment.frequency} payments`}
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-gray-700">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-blue-300">Prepayment Limits</h3>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enablePrepaymentLimits}
                      onChange={(e) => setEnablePrepaymentLimits(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    <span className="ml-3 text-sm font-medium text-gray-300">
                      {enablePrepaymentLimits ? 'Enabled' : 'Disabled'}
                    </span>
                  </label>
                </div>

                {enablePrepaymentLimits && (
                  <div className="p-3 bg-gray-700 rounded space-y-3">
                    <div>
                      <label className="block text-xs mb-1">Annual Lump Sum Limit (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={prepaymentLimits.lumpSumLimitPercent}
                        onChange={(e) => setPrepaymentLimits({...prepaymentLimits, lumpSumLimitPercent: Number(e.target.value)})}
                        className="w-full px-2 py-1 bg-gray-600 border border-gray-500 rounded text-sm"
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        Percent of original principal {mortgageDetails && `(${(mortgageDetails.totalPrincipal * prepaymentLimits.lumpSumLimitPercent / 100).toLocaleString('en-CA', { style: 'currency', currency: 'CAD' })} per year)`}
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs mb-1">Payment Increase Limit (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={prepaymentLimits.paymentIncreaseLimitPercent}
                        onChange={(e) => setPrepaymentLimits({...prepaymentLimits, paymentIncreaseLimitPercent: Number(e.target.value)})}
                        className="w-full px-2 py-1 bg-gray-600 border border-gray-500 rounded text-sm"
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        Maximum payment increase allowed per year
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs mb-1">Limit Reset Period</label>
                      <select
                        value={prepaymentLimits.resetPeriod}
                        onChange={(e) => setPrepaymentLimits({...prepaymentLimits, resetPeriod: e.target.value as 'calendar' | 'anniversary'})}
                        className="w-full px-2 py-1 bg-gray-600 border border-gray-500 rounded text-sm"
                      >
                        <option value="calendar">Calendar Year (Jan 1)</option>
                        <option value="anniversary">Mortgage Anniversary</option>
                      </select>
                      <p className="text-xs text-gray-400 mt-1">
                        When prepayment limits reset
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={handleCalculate}
                className="w-full py-4 sm:py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded font-semibold text-lg mt-6 touch-manipulation"
              >
                Calculate Schedule
              </button>
            </div>
          </div>

          {/* Results Panel */}
          <div className="lg:col-span-2">
            {schedule && (
              <div className="space-y-6">
                {/* Summary */}
                <div className="bg-gray-800 rounded-lg p-4 sm:p-6 shadow-lg">
                  <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-blue-300">Summary</h2>

                  <div className="mb-6 pb-4 border-b border-gray-700">
                    <h3 className="text-sm font-medium text-gray-400 mb-3">Purchase Details</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-gray-400">Purchase Price</p>
                        <p className="text-xl font-semibold">${schedule.summary.purchasePrice.toLocaleString('en-CA')}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Down Payment ({schedule.summary.downPaymentPercent}%)</p>
                        <p className="text-xl font-semibold text-green-400">${schedule.summary.downPayment.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Mortgage Amount</p>
                        <p className="text-xl font-semibold">${schedule.summary.mortgageAmount.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</p>
                      </div>
                      {schedule.summary.cmhcInsurance > 0 && (
                        <div>
                          <p className="text-sm text-gray-400">CMHC Insurance ({(schedule.summary.cmhcPremiumRate * 100).toFixed(2)}%)</p>
                          <p className="text-xl font-semibold text-yellow-400">${schedule.summary.cmhcInsurance.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</p>
                        </div>
                      )}
                      {schedule.summary.cmhcPst > 0 && (
                        <div>
                          <p className="text-sm text-gray-400">PST on CMHC ({(schedule.summary.cmhcPstRate * 100).toFixed(2)}%)</p>
                          <p className="text-xl font-semibold text-orange-400">${schedule.summary.cmhcPst.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</p>
                        </div>
                      )}
                      {schedule.summary.additionalFinancing > 0 && (
                        <div>
                          <p className="text-sm text-gray-400">Additional Financing</p>
                          <p className="text-xl font-semibold text-blue-400">${schedule.summary.additionalFinancing.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-sm text-gray-400">Total Principal</p>
                        <p className="text-xl font-semibold">${schedule.summary.originalPrincipal.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-gray-400 mb-3">Payment Details</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-gray-400">Total Interest</p>
                        <p className="text-xl font-semibold text-red-400">${schedule.summary.totalInterestPaid.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Total Paid</p>
                        <p className="text-xl font-semibold">${schedule.summary.totalPaid.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Total Payments</p>
                        <p className="text-xl font-semibold">{schedule.payments.length}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">First Payment</p>
                        <p className="text-xl font-semibold">${schedule.payments[0]?.payment.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Last Payment</p>
                        <p className="text-xl font-semibold">${schedule.payments[schedule.payments.length - 1]?.payment.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">First Payment Date</p>
                        <p className="text-xl font-semibold">{schedule.payments[0]?.paymentDate.toISOString().split('T')[0]}</p>
                      </div>
                    </div>
                  </div>

                  {schedule.summary.totalAdditionalPayments > 0 && (
                    <div className="pt-4 border-t border-gray-700">
                      <h3 className="text-sm font-medium text-gray-400 mb-3">Additional Payment Savings</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-sm text-gray-400">Total Additional Payments</p>
                          <p className="text-xl font-semibold text-blue-400">${schedule.summary.totalAdditionalPayments.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-400">Interest Saved</p>
                          <p className="text-xl font-semibold text-green-400">${schedule.summary.interestSaved.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-400">Time Saved</p>
                          <p className="text-xl font-semibold text-green-400">{Math.round(schedule.summary.timeSaved)} months</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-400">Actual Payoff</p>
                          <p className="text-xl font-semibold">{schedule.summary.actualPayoffMonths} months</p>
                        </div>
                      </div>

                      {schedule.summary.prepaymentLimitViolations !== undefined && schedule.summary.prepaymentLimitViolations > 0 && (
                        <div className="mt-4 p-3 bg-orange-900/20 border border-orange-500/30 rounded">
                          <div className="flex items-start gap-2">
                            <span className="text-xl">⚠️</span>
                            <div>
                              <p className="text-sm font-medium text-orange-400">Prepayment Limit Warning</p>
                              <p className="text-sm text-gray-300 mt-1">
                                {schedule.summary.prepaymentLimitViolations} payment{schedule.summary.prepaymentLimitViolations !== 1 ? 's' : ''} exceed{schedule.summary.prepaymentLimitViolations === 1 ? 's' : ''} your contractual prepayment limits.
                                These payments may incur penalties or be subject to lender approval.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
                    <button
                      onClick={handleExportCSV}
                      className="px-4 py-3 sm:py-2 bg-green-600 hover:bg-green-700 active:bg-green-800 rounded font-medium touch-manipulation"
                    >
                      Export CSV
                    </button>
                    <button
                      onClick={handleExportPDF}
                      className="px-4 py-3 sm:py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 rounded font-medium touch-manipulation"
                    >
                      Export PDF
                    </button>
                    <button
                      onClick={handleExportJSON}
                      className="px-4 py-3 sm:py-2 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 rounded font-medium touch-manipulation"
                    >
                      Export JSON
                    </button>
                  </div>
                </div>

                {/* Payment Schedule */}
                <div className="bg-gray-800 rounded-lg p-4 sm:p-6 shadow-lg">
                  <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-blue-300">Payment Schedule</h2>

                  <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
                    <div className="inline-block min-w-full align-middle">
                      <div className="text-xs sm:text-sm text-gray-400 mb-2 sm:hidden">← Scroll to see more →</div>
                      <table className="min-w-full text-xs sm:text-sm">
                      <thead className="bg-gray-700">
                        <tr>
                          <th className="px-3 py-2 text-left">#</th>
                          <th className="px-3 py-2 text-left">Date</th>
                          <th className="px-3 py-2 text-right">Payment</th>
                          <th className="px-3 py-2 text-right">Principal</th>
                          <th className="px-3 py-2 text-right">Interest</th>
                          <th className="px-3 py-2 text-right">Additional</th>
                          <th className="px-3 py-2 text-right">Balance</th>
                          <th className="px-3 py-2 text-right">Rate</th>
                          <th className="px-3 py-2 text-center">Term</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-700">
                        {schedule.payments.map((payment) => (
                          <tr
                            key={payment.paymentNumber}
                            className={
                              payment.exceedsLimit
                                ? "hover:bg-gray-700 bg-orange-900/30 border-l-2 border-orange-500"
                                : payment.additionalPayment > 0
                                ? "hover:bg-gray-700 bg-blue-900/20"
                                : "hover:bg-gray-700"
                            }
                          >
                            <td className="px-3 py-2">{payment.paymentNumber}</td>
                            <td className="px-3 py-2">{payment.paymentDate.toISOString().split('T')[0]}</td>
                            <td className="px-3 py-2 text-right">${payment.payment.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right text-green-400">${payment.principal.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right text-red-400">${payment.interest.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right">
                              {payment.additionalPayment > 0 ? (
                                <span className={payment.exceedsLimit ? "text-orange-400 font-medium" : "text-blue-400"}>
                                  ${payment.additionalPayment.toFixed(2)}
                                  {payment.exceedsLimit && <span className="ml-1" title="Exceeds prepayment limit">⚠️</span>}
                                </span>
                              ) : '-'}
                            </td>
                            <td className="px-3 py-2 text-right font-medium">${payment.balance.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right">{(payment.interestRate * 100).toFixed(3)}%</td>
                            <td className="px-3 py-2 text-center">{payment.termNumber}</td>
                          </tr>
                        ))}
                      </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!schedule && (
              <div className="bg-gray-800 rounded-lg p-12 shadow-lg text-center">
                <p className="text-gray-400 text-lg">Enter mortgage details and click "Calculate Schedule" to view results</p>
              </div>
            )}
          </div>
        </div>

        {/* Save Profile Dialog */}
        {showSaveDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full shadow-xl border border-gray-700">
              <h3 className="text-xl font-semibold mb-4 text-blue-300">
                {currentProfileId ? 'Update Mortgage Profile' : 'Save Mortgage Profile'}
              </h3>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Profile Name</label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSaveProfile()}
                  placeholder="e.g., My House, Dream Home, etc."
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              <div className="text-xs text-gray-400 mb-4 p-3 bg-gray-700 rounded">
                <p className="mb-1">This will save:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Purchase price and down payment</li>
                  <li>Amortization and payment settings</li>
                  <li>All renewal periods</li>
                  <li>All additional payments</li>
                </ul>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => handleSaveProfile(false)}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded font-medium"
                >
                  {currentProfileId ? 'Update' : 'Save'}
                </button>
                {currentProfileId && (
                  <button
                    onClick={() => handleSaveProfile(true)}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-medium"
                  >
                    Save as New
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowSaveDialog(false);
                    setProfileName('');
                  }}
                  className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
