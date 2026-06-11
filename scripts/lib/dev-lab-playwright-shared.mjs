export const waitForDevLab = async (page, timeoutMs = 60_000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ready = await page.evaluate(() => typeof window.obscurDevLab?.unlock === "function");
    if (ready) {
      return;
    }
    await page.waitForTimeout(500);
  }
  throw new Error("obscurDevLab not available");
};

export const waitForMessagingReady = async (page, timeoutMs = 90_000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = await page.evaluate(() => window.obscurDevLab?.getMessagingStatus?.() ?? null);
    if (status === "ready") {
      return;
    }
    await page.waitForTimeout(500);
  }
  throw new Error("Messaging bridge not ready");
};

export const clickSidebarLink = async (page, label) => {
  const clicked = await page.evaluate((sidebarLabel) => {
    const link = document.querySelector(`a[aria-label="${sidebarLabel}"]`);
    if (link instanceof HTMLElement) {
      link.click();
      return true;
    }
    return false;
  }, label);
  if (clicked) {
    await page.waitForTimeout(700);
  }
  return clicked;
};

export const readM8CommunityCapture = async (page, windowSize = 400) => page.evaluate((size) => {
  const capture = window.obscurM8CommunityCapture?.capture?.(size) ?? null;
  if (!capture) {
    return { available: false, capture: null };
  }
  return {
    available: true,
    capture: {
      checks: capture.checks ?? null,
      community: capture.community ?? null,
    },
  };
}, windowSize);

export const readMembershipDigestSummary = async (page, windowSize = 400) => page.evaluate((size) => {
  const digest = window.obscurAppEvents?.getCrossDeviceSyncDigest?.(size) ?? null;
  return digest?.summary ?? null;
});

export const readRuntimeCapabilities = async (page) => page.evaluate(() => {
  const w = window;
  const hasCallableNativeBridge =
    typeof w.__TAURI_INTERNALS__?.invoke === "function"
    || typeof w.__TAURI__?.core?.invoke === "function"
    || typeof w.__TAURI_IPC__ === "function";
  return {
    isNativeRuntime: hasCallableNativeBridge,
    hasCallableNativeBridge,
    hostname: window.location?.hostname ?? null,
  };
});

export const checkCoordinationHealth = async (page) => page.evaluate(async () => {
  try {
    const response = await fetch("http://127.0.0.1:8787/health", { cache: "no-store" });
    const json = await response.json();
    return { ok: response.status === 200 && json?.ok === true, status: response.status };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
});
