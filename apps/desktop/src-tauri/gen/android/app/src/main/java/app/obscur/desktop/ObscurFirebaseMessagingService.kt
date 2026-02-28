package app.obscur.desktop

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import org.json.JSONObject

// Note: These imports assume uniffi-generated bindings are available
// import uniffi.obscur.decryptPushPayload
// import uniffi.obscur.PushPreview

class ObscurFirebaseMessagingService : FirebaseMessagingService() {

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        // We only care about data messages for encrypted pushes
        if (remoteMessage.data.isNotEmpty()) {
            val payload = remoteMessage.data["payload"] ?: return
            handleEncryptedPush(payload)
        }
    }

    override fun onNewToken(token: String) {
        // In a real app, we'd send this to the Tauri layer or the relay directly
        // However, the PWA/Tauri layer will usually request the token via a plugin
        super.onNewToken(token)
    }

    private fun handleEncryptedPush(encryptedPayload: String) {
        try {
            // 1. Get current user's secret key from secure storage
            // In a production app, this would be retrieved from encrypted shared preferences or Keystore
            val sharedPrefs = getSharedPreferences("obscur_native_state", Context.MODE_PRIVATE)
            val secretKeyHex = sharedPrefs.getString("active_secret_key", null) ?: return

            // 2. Decrypt using libobscur via Uniffi
            // This is a placeholder for the actual Uniffi call
            // val preview = decryptPushPayload(secretKeyHex, encryptedPayload)
            
            // For now, we simulate the decryption result for the skeleton
            val title = "New Message"
            val body = "You have received a new encrypted message."
            
            showNotification(title, body)

        } catch (e: Exception) {
            // If decryption fails, we might show a generic "New Encrypted Message" notification
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
            .setSmallIcon(R.mipmap.ic_launcher) // Assuming standard icon
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_HIGH)

        notificationManager.notify(System.currentTimeMillis().toInt(), notificationBuilder.build())
    }
}
