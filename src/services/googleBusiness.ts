
export interface GoogleLocation {
  name: string; // locations/{locationId}
  title: string;
  storeCode?: string;
  websiteUri?: string;
  regularHours?: any;
  serviceArea?: any;
  labels?: string[];
  adWordsLocationCustomId?: string;
  latlng?: {
    latitude: number;
    longitude: number;
  };
  openTime?: string;
  metadata?: {
    mapsUri?: string;
    newReviewUri?: string;
  };
}

export interface GoogleAccount {
  name: string; // accounts/{accountId}
  accountName: string;
  type: string;
  verificationState: string;
  vettedState: string;
}

export class GoogleBusinessService {
  private static STORAGE_KEY = 'gmb_access_token';
  private static getApiKey(): string {
    return ((import.meta as any).env?.VITE_GOOGLE_API_KEY as string) || '';
  }

  static setToken(token: string | null) {
    if (token) {
      localStorage.setItem(this.STORAGE_KEY, token);
    } else {
      localStorage.removeItem(this.STORAGE_KEY);
    }
  }

  static getToken(): string | null {
    const token = localStorage.getItem(this.STORAGE_KEY);
    if (!token || token === 'null' || token === 'undefined') return null;
    return token;
  }

  static async fetchAccounts(): Promise<GoogleAccount[]> {
    const token = this.getToken();
    if (!token) throw new Error('No access token found. Please sign in with Google.');

    const url = 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts';

    console.log('Fetching GBP accounts from:', url);
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('GBP Accounts Error:', error);
      const msg = error.error?.message || `Failed to fetch accounts (${response.status})`;
      throw new Error(`Google Business Profile API error: ${msg}. Make sure both "My Business Account Management API" and "My Business Business Information API" are enabled in your Google Cloud Project.`);
    }

    const data = await response.json();
    console.log('GBP Accounts Response:', data);
    return data.accounts || [];
  }

  static async fetchLocations(accountName: string): Promise<GoogleLocation[]> {
    const token = this.getToken();
    if (!token) throw new Error('No access token found');

    // Use the Business Information API to get locations
    const url = `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title,storeCode,regularHours,websiteUri,metadata,labels`;

    console.log(`Fetching locations for ${accountName} from: ${url}`);
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      console.error(`GBP Locations Error for ${accountName}:`, error);
      // We don't throw here to avoid failing the whole sync if one account has issues
      return [];
    }

    const data = await response.json();
    console.log(`GBP Locations for ${accountName}:`, data);
    return data.locations || [];
  }

  static async fetchAllUserLocations(): Promise<GoogleLocation[]> {
    try {
      const accounts = await this.fetchAccounts();
      if (accounts.length === 0) {
        console.warn('No Google Business accounts found for this user.');
        return [];
      }

      const allLocations: GoogleLocation[] = [];

      for (const account of accounts) {
        const locations = await this.fetchLocations(account.name);
        allLocations.push(...locations);
      }

      return allLocations;
    } catch (error) {
      console.error('fetchAllUserLocations catch block:', error);
      throw error;
    }
  }
}
