export const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
  const arrayBuffer: ArrayBuffer = new ArrayBuffer(bytes.byteLength);
  const view: Uint8Array = new Uint8Array(arrayBuffer);
  view.set(bytes);
  return arrayBuffer;
};
