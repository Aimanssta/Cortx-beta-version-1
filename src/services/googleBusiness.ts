
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

  static setToken(token: string) {
    localStorage.setItem(this.STORAGE_KEY, token);
  }

  static getToken(): string | null {
    return localStorage.getItem(this.STORAGE_KEY);
  }

  static async fetchAccounts(): Promise<GoogleAccount[]> {
    const token = this.getToken();
    if (!token) throw new Error('No access token found. Please sign in with Google.');

    const apiKey = this.getApiKey();
    const url = `https://mybusinessaccountmanagement.googleapis.com/v1/accounts${apiKey ? `?key=${apiKey}` : ''}`;

    console.log('Fetching GBP accounts from:', url);
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('GBP Accounts Error:', error);
      throw new Error(error.error?.message || `Failed to fetch accounts (${response.status})`);
    }

    const data = await response.json();
    console.log('GBP Accounts Response:', data);
    return data.accounts || [];
  }

  static async fetchLocations(accountName: string): Promise<GoogleLocation[]> {
    const token = this.getToken();
    if (!token) throw new Error('No access token found');

    const apiKey = this.getApiKey();
    // Use the Business Information API to get locations
    const url = `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title,storeCode,regularHours,websiteUri,metadata,labels${apiKey ? `&key=${apiKey}` : ''}`;

    console.log(`Fetching locations for ${accountName} from: ${url}`);
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      console.error(`GBP Locations Error for ${accountName}:`, error);
      // Don't throw here if one account fails, just return empty and log
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
