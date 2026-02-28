import { minePow } from "./mine-pow";

self.onmessage = async (e: MessageEvent) => {
  const { template, difficulty } = e.data;

  try {
    const result = await minePow(template, difficulty);
    self.postMessage({ type: "success", result });
  } catch (error) {
    self.postMessage({ type: "error", error: error instanceof Error ? error.message : String(error) });
  }
};
