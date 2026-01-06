import type { RenewalPeriod, AdditionalPayment, PaymentFrequency, PrepaymentLimits } from '../types/mortgage';

export interface MortgageProfile {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  data: {
    purchasePrice: number;
    downPaymentPercent: number;
    additionalFinancing: number;
    cmhcPstRate: number;
    amortizationYears: number;
    paymentFrequency: PaymentFrequency;
    startDate: string;
    renewalPeriods: RenewalPeriod[];
    additionalPayments: AdditionalPayment[];
    prepaymentLimits?: PrepaymentLimits;
  };
}

const STORAGE_KEY = 'mortgage-profiles';

/**
 * Get all saved mortgage profiles from local storage
 */
export function getProfiles(): MortgageProfile[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading profiles:', error);
    return [];
  }
}

/**
 * Save a mortgage profile to local storage
 */
export function saveProfile(profile: Omit<MortgageProfile, 'id' | 'createdAt' | 'updatedAt'>): MortgageProfile {
  const profiles = getProfiles();

  const newProfile: MortgageProfile = {
    ...profile,
    id: generateId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  profiles.push(newProfile);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));

  return newProfile;
}

/**
 * Update an existing mortgage profile
 */
export function updateProfile(id: string, updates: Partial<Omit<MortgageProfile, 'id' | 'createdAt'>>): MortgageProfile | null {
  const profiles = getProfiles();
  const index = profiles.findIndex(p => p.id === id);

  if (index === -1) return null;

  profiles[index] = {
    ...profiles[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  return profiles[index];
}

/**
 * Delete a mortgage profile
 */
export function deleteProfile(id: string): boolean {
  const profiles = getProfiles();
  const filtered = profiles.filter(p => p.id !== id);

  if (filtered.length === profiles.length) return false;

  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  return true;
}

/**
 * Get a single profile by ID
 */
export function getProfile(id: string): MortgageProfile | null {
  const profiles = getProfiles();
  return profiles.find(p => p.id === id) || null;
}

/**
 * Generate a unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Clear all profiles (useful for testing)
 */
export function clearAllProfiles(): void {
  localStorage.removeItem(STORAGE_KEY);
}
