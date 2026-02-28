import UserNotifications
import obscur // Assuming the framework name for libobscur

class NotificationService: UNNotificationServiceExtension {

    var contentHandler: ((UNNotificationContent) -> Void)?
    var bestAttemptContent: UNMutableNotificationContent?

    override func didReceive(_ request: UNNotificationRequest, withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
        self.contentHandler = contentHandler
        bestAttemptContent = (request.content.mutableCopy() as? UNMutableNotificationContent)
        
        if let bestAttemptContent = bestAttemptContent {
            // 1. Extract the encrypted payload from the push data
            guard let payload = bestAttemptContent.userInfo["payload"] as? String else {
                contentHandler(bestAttemptContent)
                return
            }
            
            // 2. Retrieve the active secret key from the shared Keychain/Group
            // In a real app, this would be in an App Group shared with the main Tauri app
            let defaults = UserDefaults(suiteName: "group.app.obscur.desktop")
            guard let secretKeyHex = defaults?.string(forKey: "active_secret_key") else {
                bestAttemptContent.title = "New Message"
                bestAttemptContent.body = "Identity locked. Open the app to decrypt."
                contentHandler(bestAttemptContent)
                return
            }
            
            // 3. Decrypt using libobscur
            // This is a placeholder for the actual FFI call
            // do {
            //     let preview = try LibObscur.decryptPushPayload(secretKey: secretKeyHex, giftWrap: payload)
            //     bestAttemptContent.title = preview.title
            //     bestAttemptContent.body = preview.body
            // } catch {
            //     bestAttemptContent.body = "New encrypted message received"
            // }
            
            // For now, simulate the result for the skeleton
            bestAttemptContent.title = "New Message"
            bestAttemptContent.body = "You have received a new encrypted message."
            
            contentHandler(bestAttemptContent)
        }
    }
    
    override func serviceExtensionTimeWillExpire() {
        // Called just before the extension will be terminated by the system.
        // Use this as a last chance to deliver your "best attempt" at modified content, otherwise the original push payload will be used.
        if let contentHandler = contentHandler, let bestAttemptContent =  bestAttemptContent {
            contentHandler(bestAttemptContent)
        }
    }

}
