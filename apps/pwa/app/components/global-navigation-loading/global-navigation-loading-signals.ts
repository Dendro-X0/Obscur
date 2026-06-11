type GlobalNavLoadingSignalHandlers = Readonly<{
  beginChunkLoad?: () => void;
  endChunkLoad?: () => void;
}>;

let handlers: GlobalNavLoadingSignalHandlers = {};

export const registerGlobalNavLoadingSignalHandlers = (
  next: GlobalNavLoadingSignalHandlers,
): void => {
  handlers = next;
};

export const clearGlobalNavLoadingSignalHandlers = (): void => {
  handlers = {};
};

export const signalGlobalNavChunkLoadBegin = (): void => {
  handlers.beginChunkLoad?.();
};

export const signalGlobalNavChunkLoadEnd = (): void => {
  handlers.endChunkLoad?.();
};
