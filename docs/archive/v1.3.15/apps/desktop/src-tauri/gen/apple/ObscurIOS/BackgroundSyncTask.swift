import BackgroundTasks
import Foundation
import obscur

private let mobileSecureKeyId = "mobile::default::nsec"
private let mobileSyncRelays = [
    "wss://relay.damus.io",
    "wss://nos.lol",
    "wss://relay.snort.social",
    "wss://relay.primal.net",
]

private enum MobileSyncBridgeError: Error {
    case unavailable(String)
    case malformed(String)
}

private final class MobileSyncRustBridge {
    static func backgroundSyncForKey() throws -> Int {
        guard let bridgeType = NSClassFromString("ObscurBridge") as? NSObject.Type else {
            throw MobileSyncBridgeError.unavailable("rust_bridge_unavailable/background_sync_for_key")
        }
        let bridge = bridgeType.init()
        let selector = NSSelectorFromString("backgroundSyncForKey:relayUrls:")
        guard bridge.responds(to: selector) else {
            throw MobileSyncBridgeError.unavailable("rust_bridge_unavailable/background_sync_for_key")
        }
        guard let unmanaged = bridge.perform(selector, with: mobileSecureKeyId, with: mobileSyncRelays as NSArray) else {
            throw MobileSyncBridgeError.malformed("relay_offline_or_timeout")
        }
        let payload = unmanaged.takeUnretainedValue()
        if let number = payload as? NSNumber {
            return number.intValue
        }
        if let report = payload as? NSDictionary,
           let decrypted = report["decryptedMessages"] as? NSNumber {
            return decrypted.intValue
        }
        return 0
    }
}

class BackgroundSyncManager {
    static let shared = BackgroundSyncManager()
    static let taskIdentifier = "app.obscur.desktop.refresh"

    func registerTasks() {
        BGTaskScheduler.shared.register(forTaskWithIdentifier: BackgroundSyncManager.taskIdentifier, using: nil) { task in
            self.handleAppRefresh(task: task as! BGAppRefreshTask)
        }
    }

    func scheduleAppRefresh() {
        let request = BGAppRefreshTaskRequest(identifier: BackgroundSyncManager.taskIdentifier)
        request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60) // 15 minutes minimum
        
        do {
            try BGTaskScheduler.shared.submit(request)
        } catch {
            print("Could not schedule app refresh: \(error)")
        }
    }

    private func handleAppRefresh(task: BGAppRefreshTask) {
        // Schedule the next refresh task
        scheduleAppRefresh()

        let queue = OperationQueue()
        queue.maxConcurrentOperationCount = 1

        task.expirationHandler = {
            queue.cancelAllOperations()
        }

        let operation = BlockOperation {
            do {
                let decryptedCount = try MobileSyncRustBridge.backgroundSyncForKey()
                print("Background sync finished, decrypted messages: \(decryptedCount)")
                task.setTaskCompleted(success: true)
            } catch {
                let message = String(describing: error)
                if message.localizedCaseInsensitiveContains("locked_no_secure_key")
                    || message.localizedCaseInsensitiveContains("secure key unavailable") {
                    task.setTaskCompleted(success: true)
                    return
                }
                task.setTaskCompleted(success: false)
            }
        }

        queue.addOperation(operation)
    }
}
