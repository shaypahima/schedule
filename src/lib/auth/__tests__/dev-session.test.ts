import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { signDevToken } from "@/lib/pg/dev-auth";
import { readDevIdentity, isDevAuthEnabled } from "../dev-session";

const original = process.env.DB_DRIVER;

describe("dev sign-in gate", () => {
  beforeEach(() => {
    process.env.DB_DRIVER = "pg";
  });
  afterEach(() => {
    process.env.DB_DRIVER = original;
  });

  it("accepts a dev token on the local Postgres path", () => {
    const token = signDevToken({ sub: "u1", email: "t1@example.com" });

    expect(readDevIdentity(token)).toEqual({
      userId: "u1",
      email: "t1@example.com",
    });
  });

  it("refuses a perfectly valid dev token once off the local path", () => {
    const token = signDevToken({ sub: "u1", email: "t1@example.com" });
    process.env.DB_DRIVER = "supabase";

    expect(isDevAuthEnabled()).toBe(false);
    expect(readDevIdentity(token)).toBeNull();
  });

  it("has no identity without a token", () => {
    expect(readDevIdentity(undefined)).toBeNull();
  });

  it("refuses a forged token", () => {
    expect(readDevIdentity("not.a.real.token")).toBeNull();
  });
});
