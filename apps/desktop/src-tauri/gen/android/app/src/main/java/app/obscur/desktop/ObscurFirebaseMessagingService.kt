package app.obscur.desktop

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import java.lang.reflect.Method

private const val MOBILE_PUSH_SECURE_KEY_ID = "mobile::default::nsec"

private object RustPushBridge {
    private val bridgeClassCandidates = listOf(
        "uniffi.obscur.ObscurKt",
        "uniffi.libobscur.LibobscurKt",
        "obscur.ObscurKt",
        "obscur.LibobscurKt"
    )

    data class DecryptPreview(
        val title: String,
        val body: String,
    )

    private fun findDecryptMethod(): Pair<Class<*>, Method>? {
        for (className in bridgeClassCandidates) {
            val clazz = runCatching { Class.forName(className) }.getOrNull() ?: continue
            val method = clazz.methods.firstOrNull { candidate ->
                candidate.name == "decryptPushPayloadForKey" && candidate.parameterCount == 2
            } ?: continue
            return clazz to method
        }
        return null
    }

    fun decryptPushPayloadForKey(keyId: String, payload: String): DecryptPreview {
        val (_, method) = findDecryptMethod()
            ?: throw IllegalStateException("rust_bridge_unavailable/decrypt_push_payload_for_key")
        val result = method.invoke(null, keyId, payload)
            ?: throw IllegalStateException("malformed_payload/null_decrypt_preview")
        val bodyAccessor = result.javaClass.methods.firstOrNull { accessor ->
            accessor.name == "getContent" && accessor.parameterCount == 0
        } ?: throw IllegalStateException("malformed_payload/missing_content")
        val body = bodyAccessor.invoke(result)?.toString()?.trim().orEmpty()
        if (body.isEmpty()) {
            throw IllegalStateException("malformed_payload/empty_content")
        }
        val senderAccessor = result.javaClass.methods.firstOrNull { accessor ->
            accessor.name == "getSenderPubkey" && accessor.parameterCount == 0
        }
        val sender = senderAccessor?.invoke(result)?.toString()?.take(12)
        val title = if (sender.isNullOrBlank()) "New Message" else "Message from $sender"
        return DecryptPreview(title = title, body = body)
    }
}

class ObscurFirebaseMessagingService : FirebaseMessagingService() {

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        // We only care about data messages for encrypted pushes
        if (remoteMessage.data.isNotEmpty()) {
            val payload = remoteMessage.data["payload"] ?: return
            handleEncryptedPush(payload)
        }
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
    }

    private fun handleEncryptedPush(encryptedPayload: String) {
        try {
            val preview = RustPushBridge.decryptPushPayloadForKey(
                MOBILE_PUSH_SECURE_KEY_ID,
                encryptedPayload
            )
            showNotification(preview.title, preview.body)
        } catch (e: Exception) {
            val message = e.message ?: "unknown"
            if (
                message.contains("locked_no_secure_key", ignoreCase = true)
                || message.contains("secure key unavailable", ignoreCase = true)
            ) {
                showNotification("Obscur", "Identity locked. Open the app to unlock.")
                return
            }
            showNotification("Obscur", "New encrypted message received")
        }
    }

    private fun showNotification(title: String, body: String) {
        val channelId = "obscur_messages"
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "Obscur Messages",
                NotificationManager.IMPORTANCE_HIGH
            )
            notificationManager.createNotificationChannel(channel)
        }

        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
        )

        val notificationBuilder = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_HIGH)

        notificationManager.notify(System.currentTimeMillis().toInt(), notificationBuilder.build())
    }
}
