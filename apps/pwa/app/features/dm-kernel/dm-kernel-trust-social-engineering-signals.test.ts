import { describe, expect, it } from "vitest";
import {
  detectAdvanceFeeScam,
  detectAuthorityImpersonation,
  detectCredentialHarvestRequest,
  detectFakeEscrow,
  detectGiftCardScam,
  detectHiringTrap,
  detectIrreversiblePaymentDemand,
  detectOffPlatformRedirect,
  detectOverpaymentScam,
  detectRemoteAccessTool,
} from "./dm-kernel-trust-social-engineering-signals";

describe("dm-kernel-trust-social-engineering-signals", () => {
  it("detects credential harvest requests", () => {
    expect(detectCredentialHarvestRequest("Please send your 12-word seed phrase to verify")).toBe(true);
    expect(detectCredentialHarvestRequest("Share your private key so we can unlock the wallet")).toBe(true);
    expect(detectCredentialHarvestRequest("What is your 2FA code right now?")).toBe(true);
    expect(detectCredentialHarvestRequest("Please sign in here to verify your account")).toBe(true);
    expect(detectCredentialHarvestRequest("Can we sync on the deployment tomorrow?")).toBe(false);
  });

  it("detects authority impersonation", () => {
    expect(detectAuthorityImpersonation("Obscur Support here — your account has been suspended")).toBe(true);
    expect(detectAuthorityImpersonation("This is Obscur Security — verify your account")).toBe(true);
    expect(detectAuthorityImpersonation("I'm the CEO — confidential wire request")).toBe(true);
    expect(detectAuthorityImpersonation("Hey, thanks for the relay tips")).toBe(false);
  });

  it("detects gift card scam language", () => {
    expect(detectGiftCardScam("Buy $500 in Google Play gift cards and text the codes")).toBe(true);
    expect(detectGiftCardScam("Invoice attached for last month")).toBe(false);
  });

  it("detects off-platform redirect pressure", () => {
    expect(detectOffPlatformRedirect("Let's continue on Telegram — add me there")).toBe(true);
    expect(detectOffPlatformRedirect("Find me on Discord for the interview details")).toBe(true);
    expect(detectOffPlatformRedirect("See you in the group chat tomorrow")).toBe(false);
  });

  it("detects advance-fee scam language", () => {
    expect(detectAdvanceFeeScam("Pay the registration fee upfront before starting")).toBe(true);
    expect(detectAdvanceFeeScam("Purchase the training materials first and we reimburse later")).toBe(true);
    expect(detectAdvanceFeeScam("Thanks for sending the invoice")).toBe(false);
  });

  it("detects remote access tool pressure", () => {
    expect(detectRemoteAccessTool("Install AnyDesk so we can review your screen")).toBe(true);
    expect(detectRemoteAccessTool("Open TeamViewer for the support session")).toBe(true);
    expect(detectRemoteAccessTool("Let's hop on a video call tomorrow")).toBe(false);
  });

  it("detects overpayment refund scams", () => {
    expect(detectOverpaymentScam("We overpaid — refund the difference today")).toBe(true);
    expect(detectOverpaymentScam("Send back the extra amount from the mistaken transfer")).toBe(true);
    expect(detectOverpaymentScam("Invoice total is correct")).toBe(false);
  });

  it("detects fake escrow language", () => {
    expect(detectFakeEscrow("Use our secure payment portal link to release escrow")).toBe(true);
    expect(detectFakeEscrow("Pay outside the platform through our custom escrow")).toBe(true);
    expect(detectFakeEscrow("Payment received on the official marketplace")).toBe(false);
  });

  it("detects hiring trap / malware bait", () => {
    expect(detectHiringTrap("Clone this repository and run npm install for the skills test")).toBe(true);
    expect(detectHiringTrap("Download our client before the technical assessment")).toBe(true);
    expect(detectHiringTrap("Thanks for reviewing the pull request")).toBe(false);
  });

  it("detects irreversible payment demands", () => {
    expect(detectIrreversiblePaymentDemand("Payment must be bitcoin only")).toBe(true);
    expect(detectIrreversiblePaymentDemand("We only accept USDT via wire transfer only")).toBe(true);
    expect(detectIrreversiblePaymentDemand("PayPal works for this invoice")).toBe(false);
  });
});
