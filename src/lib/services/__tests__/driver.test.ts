import { describe, it, expect, afterEach } from "vitest";
import { pickAdapter } from "../driver";

const orig = { ...process.env };
afterEach(() => {
  process.env.MOCK_SERVICES = orig.MOCK_SERVICES;
  process.env.DB_DRIVER = orig.DB_DRIVER;
});

const choices = { mock: () => "mock", pg: () => "pg", supabase: () => "supabase" };

describe("pickAdapter", () => {
  it("picks mock when MOCK_SERVICES=true and a mock factory is given", () => {
    process.env.MOCK_SERVICES = "true";
    process.env.DB_DRIVER = "";
    expect(pickAdapter(choices)).toBe("mock");
  });

  it("picks pg when DB_DRIVER=pg and not full-mock", () => {
    process.env.MOCK_SERVICES = "false";
    process.env.DB_DRIVER = "pg";
    expect(pickAdapter(choices)).toBe("pg");
  });

  it("falls back to supabase when neither flag is set", () => {
    process.env.MOCK_SERVICES = "false";
    process.env.DB_DRIVER = "";
    expect(pickAdapter(choices)).toBe("supabase");
  });

  it("services without a mock adapter pick pg vs supabase regardless of MOCK_SERVICES", () => {
    process.env.MOCK_SERVICES = "true";
    process.env.DB_DRIVER = "pg";
    // No mock factory → mock mode must not pre-empt the driver choice.
    expect(pickAdapter({ pg: () => "pg", supabase: () => "supabase" })).toBe("pg");
  });

  it("no-mock service in full-mock + no pg → supabase", () => {
    process.env.MOCK_SERVICES = "true";
    process.env.DB_DRIVER = "";
    expect(pickAdapter({ pg: () => "pg", supabase: () => "supabase" })).toBe(
      "supabase",
    );
  });
});
