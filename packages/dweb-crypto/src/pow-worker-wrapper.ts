import type { NostrEventTemplate } from "./mine-pow";

export async function minePowWorker(
    template: NostrEventTemplate,
    difficulty: number
): Promise<{ id: string; tags: string[][] }> {
    return new Promise((resolve, reject) => {
        // Note: In Next.js/Vite, we usually use new Worker(new URL('./pow.worker.ts', import.meta.url))
        // But since this is a shared package, we might need the consumer to provide the worker
        // or use a blob if we want to be truly self-contained.
        // For now, we assume a standard worker initialization that works with modern bundlers.

        const worker = new Worker(new URL("./pow.worker.ts", import.meta.url), {
            type: "module",
        });

        worker.onmessage = (e) => {
            const { type, result, error } = e.data;
            if (type === "success") {
                resolve(result);
                worker.terminate();
            } else {
                reject(new Error(error));
                worker.terminate();
            }
        };

        worker.onerror = (e) => {
            reject(new Error("Worker error: " + e.message));
            worker.terminate();
        };

        worker.postMessage({ template, difficulty });
    });
}
