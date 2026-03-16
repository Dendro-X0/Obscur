export type PasswordStrengthLevel = "weak" | "fair" | "good" | "strong";

export type PasswordStrengthSnapshot = Readonly<{
  score: number;
  maxScore: number;
  level: PasswordStrengthLevel;
  label: string;
  hint: string;
}>;

const hasUppercase = (value: string): boolean => /[A-Z]/.test(value);
const hasLowercase = (value: string): boolean => /[a-z]/.test(value);
const hasDigit = (value: string): boolean => /\d/.test(value);
const hasSymbol = (value: string): boolean => /[^A-Za-z0-9]/.test(value);

const toLevel = (score: number): PasswordStrengthLevel => {
  if (score >= 5) {
    return "strong";
  }
  if (score >= 4) {
    return "good";
  }
  if (score >= 3) {
    return "fair";
  }
  return "weak";
};

const toLabel = (level: PasswordStrengthLevel): string => {
  switch (level) {
    case "strong":
      return "Strong";
    case "good":
      return "Good";
    case "fair":
      return "Fair";
    default:
      return "Weak";
  }
};

const toHint = (level: PasswordStrengthLevel): string => {
  switch (level) {
    case "strong":
      return "Great password resilience.";
    case "good":
      return "Good baseline. A bit more length improves it.";
    case "fair":
      return "Add more variety and length.";
    default:
      return "Use 12+ chars with upper/lowercase, numbers, and symbols.";
  }
};

export const evaluatePasswordStrength = (password: string): PasswordStrengthSnapshot => {
  if (password.length === 0) {
    return {
      score: 0,
      maxScore: 5,
      level: "weak",
      label: "Weak",
      hint: "Use 12+ chars with upper/lowercase, numbers, and symbols.",
    };
  }

  let score = 0;
  if (password.length >= 8) {
    score += 1;
  }
  if (password.length >= 12) {
    score += 1;
  }
  if (hasUppercase(password) && hasLowercase(password)) {
    score += 1;
  }
  if (hasDigit(password)) {
    score += 1;
  }
  if (hasSymbol(password)) {
    score += 1;
  }

  const level = toLevel(score);
  return {
    score,
    maxScore: 5,
    level,
    label: toLabel(level),
    hint: toHint(level),
  };
};
