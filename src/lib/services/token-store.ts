export interface GoogleTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // unix ms
}

export interface TokenStore {
  getTokens(): Promise<GoogleTokens | null>;
  setTokens(tokens: GoogleTokens): Promise<void>;
  clearTokens(): Promise<void>;
}

/**
 * In-memory token store for dev/testing.
 * In production, tokens go to Supabase coach_settings.
 */
export class InMemoryTokenStore implements TokenStore {
  private tokens: GoogleTokens | null = null;

  async getTokens(): Promise<GoogleTokens | null> {
    return this.tokens;
  }

  async setTokens(tokens: GoogleTokens): Promise<void> {
    this.tokens = tokens;
  }

  async clearTokens(): Promise<void> {
    this.tokens = null;
  }
}
