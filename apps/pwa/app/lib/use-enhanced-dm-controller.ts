/**
 * Re-export enhanced DM controller for easy imports
 */
export { useEnhancedDMController } from "./messaging/enhanced-dm-controller";

// Also export with lowercase 'm' for backward compatibility
export { useEnhancedDMController as useEnhancedDmController } from "./messaging/enhanced-dm-controller";

export type { 
  Message, 
  MessageStatus, 
  OutgoingMessage,
  RelayResult 
} from "./messaging/message-queue";
