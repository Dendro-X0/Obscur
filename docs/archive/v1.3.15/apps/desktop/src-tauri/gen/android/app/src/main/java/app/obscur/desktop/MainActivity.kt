package app.obscur.desktop

import android.os.Bundle
import androidx.activity.enableEdgeToEdge
import androidx.work.Constraints
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    
    scheduleBackgroundSync()
  }

  private fun scheduleBackgroundSync() {
    val constraints = Constraints.Builder()
      .setRequiredNetworkType(NetworkType.CONNECTED)
      .build()

    val syncRequest = PeriodicWorkRequestBuilder<BackgroundSyncWorker>(
      15, TimeUnit.MINUTES, // Minimum allowable interval for WorkManager
      5, TimeUnit.MINUTES    // Flex interval
    )
      .setConstraints(constraints)
      .build()

    WorkManager.getInstance(applicationContext).enqueueUniquePeriodicWork(
      "ObscurBackgroundSync",
      androidx.work.ExistingPeriodicWorkPolicy.KEEP,
      syncRequest
    )
  }
}
