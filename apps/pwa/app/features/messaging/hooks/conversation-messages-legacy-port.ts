import { isObscurAllowLegacy } from "@/app/engine-lab/engine-lab-policy";
import { isDmKernelAuthority } from "@/app/features/dm-kernel/dm-kernel-policy";

export { useLegacyConversationMessages } from "./use-conversation-messages-legacy";

/** Legacy DM thread hydrate hook — opt-in only when dm-kernel is not authority. */
export const shouldUseLegacyConversationMessagesHydrate = (): boolean => (
  isObscurAllowLegacy() && !isDmKernelAuthority()
);
