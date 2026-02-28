# Sealed Community & Network Issues Documentation

This document serves as an analysis record of the various structural and logic issues discovered during the recent refinement of the **Contacts** and **Sealed Community (NIP-29)** features.

## 1. Contact Request Sidedness (Resolved)
**Issue:** Senders of "Add Contact" (NIP-17 connection requests) were presented with interactive "Accept" and "Reject" buttons for requests they generated themselves. If a user maliciously or accidentally clicked "Accept" on their own outgoing request, it caused corrupted local data states.
**Resolution:** Updated `PendingRequestCard` and `InvitationCard` components to conditionally render UI based on the `req.isOutgoing` property. Outgoing requests now display read-only status identifiers ("Sent" and "Pending Confirmation").

## 2. Group Administrative UI Bloat (Resolved)
**Issue:** Even after transitioning toward a flatter "Member-centric" governance model, the Community pages still rendered administrative action buttons (e.g. "Manage Community", Avatar upload rings, Admin badges).
**Resolution:** Stripped out `isAdmin` checks and related unneeded components in `groups/[...id]/page.tsx`, bringing all users down to the unified "Member" presentation view with a standardized "Leave Community" safety exit.

## 3. Real-Time Member Count & Roster Sync (Resolved)
**Issue:** When new users joined a community, the `displayMemberCount` inside the app increased locally, but the avatars themselves failed to update. Furthermore, when users departed, the count never went down.
**Technical Cause:** The component calculating membership was using a `Set` to merge the active live relay members (`discoveredMembers`) with the stale local cache (`group.memberPubkeys`). Because arrays only ever gained objects over time, the cache eternally preserved dead memberships.
**Resolution:** Introduced an `activeMembers` variable that delegates strictly to the live relay feed while the app is connected. Real-time avatar rendering now iterates on this definitive truth source instead of the stale offline array.

## 4. Sub-Protocol "Ghosting" on Member Departure (Resolved)
**Issue:** If User A clicked "Leave Community", the local UI reflected that they left, yet User B still saw User A in the community count. 
**Technical Cause:** A decentralized group governed entirely by an E2E-encrypted Room Key has no centralized server to notice disconnections. Because User A was only destroying their *local* Room Key and never broadcasting a network separation event, other clients implicitly verified User A as active based on historic credentials.
**Resolution:** Implemented `sendSealedLeave()` within `GroupService`. When users choose to leave a community, they inject a sealed `type: "leave"` signal onto the timeline. Clients actively connected intercept this signal and purge the departed public key from `activeMembers`.

## 5. Re-Invitation "Spam Block" Loop (Resolved)
**Issue:** Once User A formally left the group (as described in Issue 4), User B was completely incapable of bringing User A back inside, encountering "already member" or "wait for confirmation" errors.
**Technical Cause:** The `invite-contacts-dialog` and `invite-member-dialog` logic featured highly aggressive UX defenses to prevent duplicate invites, including deep-scanning historic DM threads for previous invites and querying stale local membership arrays. These defenses mistakenly concluded that User A was safely in the group, rendering re-invitations impossible.
**Resolution:** Completely disabled the chat-history scanning loop for community invitations and bypassed the hard-block conditions. Users can now liberally blast new NIP-17 Group Invitation wrapped keys to peers, ensuring complete resilience for dropped keys or returning network members.

## 6. The "Chronological Ghosting" Bug (Reverse State Mutation)
**Issue:** User B explicitly leaves the community. For a brief moment, they correctly vanish from User A's active member roster. However, milliseconds later, User B reappears back in the community on User A's interface, causing a "ghosting" effect where User B appears permanently stuck inside.
**Technical Cause:** This is an architectural side-effect of Decentralized Relays. Nostr relays stream historical events **newest-first** (reverse chronological order).
1. The relay pushes User B's `type: "leave"` event (Time: Now). The system correctly marks User B as "left".
2. The relay immediately pushes an older chat message from User B (Time: Yesterday).
3. The system's "auto-rehabilitate" logic notices User B is sending a message. Ignoring the timestamp, it assumes User B must be actively participating, and automatically resurrects their active membership status, entirely reversing the leave action.
**Required Architecture Fix:** System state reducers MUST implement a `latestStatusTimestamp` guard. When parsing any community action or message, the reducer must compare the `created_at` timestamp against the user's most recently observed timestamp. If an event is chronologically *older* than an already-processed state change, the event is treated strictly as archival data, forbidding it from modifying active state trackers.

## 7. Asymmetrical Integration (Silent Joiners)
**Issue:** User A successfully sends an invitation to User C. User C clicks "Accept" and the UI says they joined successfully. However, User A's community interface still shows User C as "Pending" and the member count does not increment.
**Technical Cause:** The community invitation process relies on an out-of-band NIP-17 Direct Message containing the group's Room Key. When User C accepts the invite, they successfully decrypt and save the Room Key locally to their device. However, they silently enter the room. Without a centralized backend to observe them joining, User A and the rest of the community remain completely unaware of User C's arrival until User C happens to send a chat message, thereby "auto-rehabilitating" themselves into the roster.
**Required Architecture Fix:** A sealed membership handshake must be injected into the acceptance flow. Upon decrypting and saving the Room Key, User C's client must immediately utilize the GroupService to encrypt and broadcast a formal `type: "join"` sealed event to the community timeline. All active clients listening to the community timeline must parse this event and push the new public key into their active routing lists.

## 8. Missing Routing Parameters on Cancellations
**Issue:** When an Inviter attempts to cancel a pending invitation, it fails silently or returns an error.
**Technical Cause:** The UI allows cancelling an outgoing invitation by sending a cancellation DM back to the original recipient. However, legacy invitation records stored in the local SQLite database frequently omitted the `recipientPubkey` metadata field. When the `handleCancel` logic fired, it submitted an empty target string, breaking the NIP-17 encryption pipeline.
**Required Architecture Fix:** Implement fallback target inference. When `message.recipientPubkey` is missing, the system should mathematically infer the target by splitting the bipartite `conversationId` (e.g., `pubkeyA:pubkeyB`) and filtering out the sender's own key.
