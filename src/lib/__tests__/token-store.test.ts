import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryTokenStore } from "@/lib/services/token-store";

describe("InMemoryTokenStore", () => {
  let store: InMemoryTokenStore;

  beforeEach(() => {
    store = new InMemoryTokenStore();
  });

  it("returns null when no tokens stored", async () => {
    expect(await store.getTokens()).toBeNull();
  });

  it("stores and retrieves tokens", async () => {
    const tokens = {
      accessToken: "access-123",
      refreshToken: "refresh-456",
      expiresAt: Date.now() + 3600_000,
    };
    await store.setTokens(tokens);
    expect(await store.getTokens()).toEqual(tokens);
  });

  it("overwrites existing tokens", async () => {
    await store.setTokens({
      accessToken: "old",
      refreshToken: "old",
      expiresAt: 0,
    });
    const newTokens = {
      accessToken: "new",
      refreshToken: "new",
      expiresAt: 999,
    };
    await store.setTokens(newTokens);
    expect(await store.getTokens()).toEqual(newTokens);
  });

  it("clears tokens", async () => {
    await store.setTokens({
      accessToken: "a",
      refreshToken: "r",
      expiresAt: 0,
    });
    await store.clearTokens();
    expect(await store.getTokens()).toBeNull();
  });
});
