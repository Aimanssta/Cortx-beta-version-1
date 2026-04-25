
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

  static setToken(token: string) {
    localStorage.setItem(this.STORAGE_KEY, token);
  }

  static getToken(): string | null {
    return localStorage.getItem(this.STORAGE_KEY);
  }

  static async fetchAccounts(): Promise<GoogleAccount[]> {
    const token = this.getToken();
    if (!token) throw new Error('No access token found');

    const response = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to fetch accounts');
    }

    const data = await response.json();
    return data.accounts || [];
  }

  static async fetchLocations(accountName: string): Promise<GoogleLocation[]> {
    const token = this.getToken();
    if (!token) throw new Error('No access token found');

    // Use the Business Information API to get locations
    const response = await fetch(`https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title,storeCode,regularHours,websiteUri,metadata,labels`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to fetch locations');
    }

    const data = await response.json();
    return data.locations || [];
  }

  static async fetchAllUserLocations(): Promise<GoogleLocation[]> {
    const accounts = await this.fetchAccounts();
    const allLocations: GoogleLocation[] = [];

    for (const account of accounts) {
      const locations = await this.fetchLocations(account.name);
      allLocations.push(...locations);
    }

    return allLocations;
  }
}
