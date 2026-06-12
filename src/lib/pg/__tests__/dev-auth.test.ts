import { describe, it, expect, beforeAll } from "vitest";
import { signDevToken, verifyDevToken } from "../dev-auth";

beforeAll(() => {
  process.env.DEV_JWT_SECRET = "test-secret-at-least-thirty-two-characters!";
});

describe("dev-auth token roundtrip", () => {
  it("signs and verifies a token, returning userId + email", () => {
    const token = signDevToken({
      sub: "11111111-1111-1111-1111-111111111111",
      email: "coach@example.com",
      role: "coach",
    });
    const session = verifyDevToken(token);
    expect(session).toEqual({
      userId: "11111111-1111-1111-1111-111111111111",
      email: "coach@example.com",
    });
  });

  it("rejects a garbage token", () => {
    expect(verifyDevToken("not-a-jwt")).toBeNull();
  });

  it("rejects a token signed with a different secret", () => {
    const token = signDevToken({ sub: "abc", email: "x@y.z" });
    process.env.DEV_JWT_SECRET = "a-completely-different-secret-32-chars!!";
    expect(verifyDevToken(token)).toBeNull();
    process.env.DEV_JWT_SECRET = "test-secret-at-least-thirty-two-characters!";
  });
});
