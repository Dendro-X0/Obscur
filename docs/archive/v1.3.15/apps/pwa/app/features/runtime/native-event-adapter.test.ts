import { beforeEach, describe, expect, it, vi } from "vitest";

const runtimeMocks = vi.hoisted(() => ({
  hasNativeRuntime: vi.fn(),
}));

const webviewMocks = vi.hoisted(() => ({
  getCurrentWebviewWindow: vi.fn(),
  listen: vi.fn(),
}));

vi.mock("./runtime-capabilities", () => ({
  hasNativeRuntime: runtimeMocks.hasNativeRuntime,
}));

vi.mock("@tauri-apps/api/webviewWindow", () => ({
  getCurrentWebviewWindow: webviewMocks.getCurrentWebviewWindow,
}));

import { listenToNativeEvent, nativeEventAdapterInternals } from "./native-event-adapter";

describe("native-event-adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nativeEventAdapterInternals.resetForTests();
    webviewMocks.getCurrentWebviewWindow.mockReturnValue({
      listen: webviewMocks.listen,
    });
  });

  it("returns noop unlisten in unsupported runtime", async () => {
    runtimeMocks.hasNativeRuntime.mockReturnValue(false);

    const unlisten = await listenToNativeEvent("deep-link", () => undefined);

    expect(typeof unlisten).toBe("function");
    expect(webviewMocks.listen).not.toHaveBeenCalled();
  });

  it("registers listener in native runtime", async () => {
    const unlisten = vi.fn();
    runtimeMocks.hasNativeRuntime.mockReturnValue(true);
    webviewMocks.listen.mockResolvedValue(unlisten);
    const handler = vi.fn();

    const result = await listenToNativeEvent("deep-link", handler);

    expect(webviewMocks.listen).toHaveBeenCalledWith("deep-link", expect.any(Function));
    expect(typeof result).toBe("function");
  });

  it("reuses one native listener for multiple handlers on the same event", async () => {
    runtimeMocks.hasNativeRuntime.mockReturnValue(true);
    const nativeUnlisten = vi.fn();
    const capturedCallbacks: Array<(event: { payload?: { value: number } }) => void> = [];
    webviewMocks.listen.mockImplementation(async (_eventName: string, handler: (event: { payload?: { value: number } }) => void) => {
      capturedCallbacks[0] = handler;
      return nativeUnlisten;
    });

    const handlerOne = vi.fn();
    const handlerTwo = vi.fn();
    const disposeOne = await listenToNativeEvent("relay-event", handlerOne);
    const disposeTwo = await listenToNativeEvent("relay-event", handlerTwo);

    expect(webviewMocks.getCurrentWebviewWindow).toHaveBeenCalledTimes(1);
    expect(webviewMocks.listen).toHaveBeenCalledTimes(1);
    expect(nativeEventAdapterInternals.getRegistrySize()).toBe(1);
    expect(nativeEventAdapterInternals.getListenerCount("relay-event")).toBe(2);

    const emit = capturedCallbacks[0];
    if (!emit) {
      throw new Error("Expected native event callback to be registered");
    }
    emit({ payload: { value: 7 } });
    expect(handlerOne).toHaveBeenCalledWith({ payload: { value: 7 } });
    expect(handlerTwo).toHaveBeenCalledWith({ payload: { value: 7 } });

    disposeOne();
    expect(nativeEventAdapterInternals.getListenerCount("relay-event")).toBe(1);
    emit({ payload: { value: 11 } });
    expect(handlerOne).toHaveBeenCalledTimes(1);
    expect(handlerTwo).toHaveBeenCalledTimes(2);

    disposeTwo();
    expect(nativeEventAdapterInternals.getListenerCount("relay-event")).toBe(0);
    expect(nativeUnlisten).not.toHaveBeenCalled();
  });
});
