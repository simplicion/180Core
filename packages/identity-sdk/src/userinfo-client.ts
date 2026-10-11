'use strict';

export interface OneEightyUserProfile {
  id: string;
  sub: string;
  name: string;
  username?: string;
  email: string;
  phone?: string;
  city?: string;
  country?: string;
  avatar?: string;
  bio?: string;
  companyId?: string | null;
  company?: any;
  role?: string;
  [key: string]: any;
}

export class UserInfoClient {
  /**
   * Fetch user profile from OIDC userinfo endpoint using access token
   */
  static async fetchProfile(userInfoEndpoint: string, accessToken: string): Promise<OneEightyUserProfile> {
    const res = await fetch(userInfoEndpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch userinfo from ${userInfoEndpoint}: ${res.statusText}`);
    }

    return await res.json();
  }
}
