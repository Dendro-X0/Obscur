import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";

export const isTauri = (): boolean => hasNativeRuntime();

export async function notifyNewMessage(from: string, preview: string) {
    if (!isTauri()) return;

    try {
        const { sendNotification, isPermissionGranted, requestPermission } = await import("@tauri-apps/plugin-notification");
        let permissionGranted = await isPermissionGranted();
        if (!permissionGranted) {
            const permission = await requestPermission();
            permissionGranted = permission === 'granted';
        }

        if (permissionGranted) {
            await sendNotification({
                title: from,
                body: preview,
            });
        }
    } catch (error) {
        console.error("Failed to send notification:", error);
    }
}
