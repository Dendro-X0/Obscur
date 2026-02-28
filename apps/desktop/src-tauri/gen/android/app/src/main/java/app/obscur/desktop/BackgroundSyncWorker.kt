package app.obscur.desktop

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
// import uniffi.obscur.backgroundSync // Assuming uniffi-generated bindings

class BackgroundSyncWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        Log.i("BackgroundSyncWorker", "Starting periodic background sync...")

        return try {
            // 1. Get the current user's secret key
            val sharedPrefs = applicationContext.getSharedPreferences("obscur_native_state", Context.MODE_PRIVATE)
            val secretKeyHex = sharedPrefs.getString("active_secret_key", null)

            if (secretKeyHex == null) {
                Log.w("BackgroundSyncWorker", "No active secret key found, skipping sync.")
                return Result.success() // Or failure, depending on if we want to retry
            }

            // 2. Call libobscur sync via FFI
            // val newMessagesCount = backgroundSync(secretKeyHex)
            val newMessagesCount = 5 // Placeholder for FFI call
            
            Log.i("BackgroundSyncWorker", "Background sync completed. New messages: $newMessagesCount")

            // 3. Optional: Trigger a notification if new messages found and app is not in foreground
            // (Handled by the worker if needed, or by the system when sync completes)

            Result.success()
        } catch (e: Exception) {
            Log.e("BackgroundSyncWorker", "Background sync failed: ${e.message}", e)
            Result.retry()
        }
    }
}
