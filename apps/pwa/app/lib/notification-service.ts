import { sendNotification, isPermissionGranted, requestPermission } from '@tauri-apps/plugin-notification';

export const isTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export async function notifyNewMessage(from: string, preview: string) {
    if (!isTauri()) return;

    try {
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
