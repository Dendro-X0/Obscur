import UserNotifications
import Foundation
import obscur

private let mobilePushSecureKeyId = "mobile::default::nsec"

private enum MobilePushBridgeError: Error {
    case unavailable(String)
    case malformed(String)
}

private final class MobilePushRustBridge {
    static func decryptPushPayloadForKey(_ payload: String) throws -> (title: String, body: String) {
        guard let bridgeType = NSClassFromString("ObscurBridge") as? NSObject.Type else {
            throw MobilePushBridgeError.unavailable("rust_bridge_unavailable/decrypt_push_payload_for_key")
        }
        let bridge = bridgeType.init()
        let selector = NSSelectorFromString("decryptPushPayloadForKey:giftWrapJson:")
        guard bridge.responds(to: selector) else {
            throw MobilePushBridgeError.unavailable("rust_bridge_unavailable/decrypt_push_payload_for_key")
        }
        guard let unmanaged = bridge.perform(selector, with: mobilePushSecureKeyId, with: payload) else {
            throw MobilePushBridgeError.malformed("malformed_payload/null_preview")
        }
        let value = unmanaged.takeUnretainedValue()
        if let preview = value as? NSDictionary {
            let body = (preview["content"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            let sender = (preview["senderPubkey"] as? String)?.prefix(12) ?? ""
            if body.isEmpty {
                throw MobilePushBridgeError.malformed("malformed_payload/empty_content")
            }
            let title = sender.isEmpty ? "New Message" : "Message from \(sender)"
            return (title, body)
        }
        throw MobilePushBridgeError.malformed("malformed_payload/unexpected_preview")
    }
}

class NotificationService: UNNotificationServiceExtension {

    var contentHandler: ((UNNotificationContent) -> Void)?
    var bestAttemptContent: UNMutableNotificationContent?

    override func didReceive(_ request: UNNotificationRequest, withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
        self.contentHandler = contentHandler
        bestAttemptContent = (request.content.mutableCopy() as? UNMutableNotificationContent)
        
        if let bestAttemptContent = bestAttemptContent {
            guard let payload = bestAttemptContent.userInfo["payload"] as? String else {
                contentHandler(bestAttemptContent)
                return
            }

            do {
                let preview = try MobilePushRustBridge.decryptPushPayloadForKey(payload)
                bestAttemptContent.title = preview.title
                bestAttemptContent.body = preview.body
            } catch {
                let message = String(describing: error)
                if message.localizedCaseInsensitiveContains("locked_no_secure_key")
                    || message.localizedCaseInsensitiveContains("secure key unavailable") {
                    bestAttemptContent.title = "New Message"
                    bestAttemptContent.body = "Identity locked. Open the app to decrypt."
                } else {
                    bestAttemptContent.title = "Obscur"
                    bestAttemptContent.body = "New encrypted message received"
                }
            }
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
