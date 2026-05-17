import { describe, expect, it } from "vitest";
import {
  DELETED_ACCOUNT_ABOUT_TEXT,
  DELETED_ACCOUNT_DISPLAY_NAME,
  isDeletedAccountProfile,
} from "./deleted-profile";

describe("isDeletedAccountProfile", () => {
  it("matches deleted profile by display name", () => {
    expect(isDeletedAccountProfile({
      displayName: "Deleted Account",
    })).toBe(true);
  });

  it("matches deleted profile by about marker", () => {
    expect(isDeletedAccountProfile({
      about: "This account has been deleted.",
    })).toBe(true);
  });

  it("is case-insensitive and trims inputs", () => {
    expect(isDeletedAccountProfile({
      displayName: `  ${DELETED_ACCOUNT_DISPLAY_NAME.toUpperCase()}  `,
      about: `  ${DELETED_ACCOUNT_ABOUT_TEXT.toUpperCase()}  `,
    })).toBe(true);
  });

  it("does not match normal profiles", () => {
    expect(isDeletedAccountProfile({
      displayName: "Alice",
      about: "Hello world",
    })).toBe(false);
  });
});
