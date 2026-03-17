package app.obscur.desktop

import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import java.lang.reflect.Method

private const val MOBILE_SECURE_KEY_ID = "mobile::default::nsec"
private val MOBILE_DEFAULT_RELAYS = listOf(
    "wss://relay.damus.io",
    "wss://nos.lol",
    "wss://relay.snort.social",
    "wss://relay.primal.net"
)

private object RustMobileSyncBridge {
    private val bridgeClassCandidates = listOf(
        "uniffi.obscur.ObscurKt",
        "uniffi.libobscur.LibobscurKt",
        "obscur.ObscurKt",
        "obscur.LibobscurKt"
    )

    private fun findSyncMethod(): Pair<Class<*>, Method>? {
        for (className in bridgeClassCandidates) {
            val clazz = runCatching { Class.forName(className) }.getOrNull() ?: continue
            val method = clazz.methods.firstOrNull { candidate ->
                candidate.name == "backgroundSyncForKey" && candidate.parameterCount >= 2
            } ?: continue
            return clazz to method
        }
        return null
    }

    fun backgroundSyncForKey(keyId: String, relayUrls: List<String>): Int {
        val (_, method) = findSyncMethod()
            ?: throw IllegalStateException("rust_bridge_unavailable/background_sync_for_key")
        val args = when (method.parameterCount) {
            2 -> arrayOf(keyId, relayUrls)
            3 -> arrayOf(keyId, relayUrls, null)
            else -> throw IllegalStateException("rust_bridge_signature_mismatch/background_sync_for_key")
        }
        val result = method.invoke(null, *args)
        return extractDecryptedCount(result)
    }

    private fun extractDecryptedCount(payload: Any?): Int {
        if (payload == null) {
            return 0
        }
        if (payload is Number) {
            return payload.toInt()
        }
        val accessor = payload.javaClass.methods.firstOrNull { method ->
            method.name == "getDecryptedMessages" && method.parameterCount == 0
        } ?: return 0
        val value = accessor.invoke(payload)
        return (value as? Number)?.toInt() ?: 0
    }
}

class BackgroundSyncWorker(
    context: android.content.Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        Log.i("BackgroundSyncWorker", "Starting periodic background sync...")

        return try {
            val decryptedCount = RustMobileSyncBridge.backgroundSyncForKey(
                MOBILE_SECURE_KEY_ID,
                MOBILE_DEFAULT_RELAYS
            )
            Log.i("BackgroundSyncWorker", "Background sync completed. Decrypted messages: $decryptedCount")
            Result.success()
        } catch (e: Exception) {
            val message = e.message ?: "unknown"
            if (
                message.contains("locked_no_secure_key", ignoreCase = true)
                || message.contains("secure key unavailable", ignoreCase = true)
            ) {
                Log.w("BackgroundSyncWorker", "Secure identity unavailable; sync remains locked.")
                return Result.success()
            }
            Log.e("BackgroundSyncWorker", "Background sync failed: $message", e)
            Result.retry()
        }
    }
}
