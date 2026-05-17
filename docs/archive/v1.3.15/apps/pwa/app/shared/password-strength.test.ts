import { describe, expect, it } from "vitest";
import { evaluatePasswordStrength } from "./password-strength";

describe("evaluatePasswordStrength", () => {
  it("rates simple short passwords as weak", () => {
    const result = evaluatePasswordStrength("abc");
    expect(result.level).toBe("weak");
    expect(result.score).toBeLessThan(3);
  });

  it("rates long mixed passwords as strong", () => {
    const result = evaluatePasswordStrength("Abcd1234!Secure");
    expect(result.level).toBe("strong");
    expect(result.score).toBeGreaterThanOrEqual(5);
  });
});
