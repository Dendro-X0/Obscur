export const toBase64 = (bytes: Uint8Array): string => {
  let binary: string = "";
  bytes.forEach((b: number) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
};
