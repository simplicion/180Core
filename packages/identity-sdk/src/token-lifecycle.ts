'use strict';

import { TokenExchangeClient, TokenResponse } from './token-exchange';

export interface TokenLifecycleConfig {
  tokenEndpoint: string;
  clientId: string;
  clientSecret?: string;
  refreshToken: string;
  expiresInSeconds?: number;
  refreshMarginSeconds?: number; // e.g. 60s before token expires
  onTokenRefreshed?: (tokens: TokenResponse) => void;
  onRefreshFailed?: (error: Error) => void;
}

export class TokenLifecycleManager {
  private timer: any = null;
  private currentTokens: TokenResponse | null = null;
  private config: TokenLifecycleConfig;
  private isRefreshing: boolean = false;

  constructor(config: TokenLifecycleConfig, initialTokens?: TokenResponse) {
    this.config = config;
    if (initialTokens) {
      this.currentTokens = initialTokens;
      this.scheduleRefresh(initialTokens.expires_in || config.expiresInSeconds || 900);
    }
  }

  /**
   * Schedule the next silent refresh cycle
   */
  public scheduleRefresh(expiresInSeconds: number) {
    this.stop();
    const margin = this.config.refreshMarginSeconds ?? 60;
    // Schedule refresh 'margin' seconds before token expiry, minimum 10 seconds from now
    const refreshDelayMs = Math.max(10, expiresInSeconds - margin) * 1000;

    this.timer = setTimeout(async () => {
      try {
        await this.refreshNow();
      } catch (err: any) {
        if (this.config.onRefreshFailed) {
          this.config.onRefreshFailed(err);
        }
      }
    }, refreshDelayMs);
  }

  /**
   * Immediately refresh the token
   */
  public async refreshNow(): Promise<TokenResponse> {
    if (this.isRefreshing) {
      // If already in flight, wait 1 second
      await new Promise((r) => setTimeout(r, 1000));
      if (this.currentTokens) return this.currentTokens;
    }

    this.isRefreshing = true;
    try {
      const activeRefreshToken = this.currentTokens?.refresh_token || this.config.refreshToken;
      if (!activeRefreshToken) {
        throw new Error('[TokenLifecycleManager] No refresh token available');
      }

      const refreshed = await TokenExchangeClient.refreshToken({
        tokenEndpoint: this.config.tokenEndpoint,
        clientId: this.config.clientId,
        clientSecret: this.config.clientSecret,
        refreshToken: activeRefreshToken,
      });

      this.currentTokens = refreshed;
      if (this.config.onTokenRefreshed) {
        this.config.onTokenRefreshed(refreshed);
      }

      // Schedule next cycle based on refreshed token's lifetime
      this.scheduleRefresh(refreshed.expires_in || 900);
      return refreshed;
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Get the current valid access token, auto-refreshing if expired or within margin
   */
  public async getValidAccessToken(): Promise<string> {
    if (!this.currentTokens) {
      const tokens = await this.refreshNow();
      return tokens.access_token;
    }
    return this.currentTokens.access_token;
  }

  /**
   * Stop scheduled background refresh timer
   */
  public stop() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
