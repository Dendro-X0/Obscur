# Strategic Technology Analysis: Obscur v2.0

## Executive Summary

This document analyzes potential library additions (TanStack, Zod, Redis, etc.) and long-term architectural considerations including safety systems, local AI, plugin architecture, and Sybil resistance—all evaluated against the project's core principles of **decentralization, privacy, and user sovereignty**.

**Recommendation**: Adopt TanStack Query + Zod for immediate architecture benefits. Defer Redis and centralized infrastructure. Design safety/AI systems with privacy-preserving, local-first architecture.

---

## Part 1: Library Evaluation Matrix

### Current Stack Analysis

| Component | Current | Pain Points | Opportunity |
|-----------|---------|-------------|-------------|
| State Management | React Context + Custom stores | Profile isolation issues, implicit scope | TanStack Query + explicit DI |
| Validation | Manual type guards | Runtime validation gaps, unsafe parsing | Zod schema validation |
| Data Fetching | Custom hooks | Cache invalidation chaos, no deduplication | TanStack Query |
| Virtualization | Custom | Complex, buggy with large lists | TanStack Virtual |
| Backend Cache | None (Nostr relays only) | No coordination layer | **Anti-pattern for decentralization** |

### Library-by-Library Analysis

#### ✅ TanStack Ecosystem (RECOMMENDED)

**TanStack Query (React Query)**
- **Purpose**: Server state management, caching, synchronization
- **Decentralization Fit**: ⚠️ MODERATE (works with relays, but designed for client-server)
- **Value**: Eliminates custom cache logic, provides background refetching, deduplication
- **Usage Pattern**: 
  ```typescript
  // For Nostr relay subscriptions
  const { data: messages } = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () => subscribeToRelay(conversationId),
    staleTime: 30000, // 30s cache
  });
  ```
- **Risk**: Could encourage centralized API thinking. Must be used with relay-first mindset.
- **Verdict**: ✅ ADOPT - Replace custom `useConversationMessages` and cache chaos

**TanStack Virtual**
- **Purpose**: Virtualize large lists (message history, member lists)
- **Decentralization Fit**: ✅ HIGH (pure UI optimization)
- **Value**: Solves performance issues in large communities (10k+ messages)
- **Verdict**: ✅ ADOPT - Performance win, no architectural tradeoffs

**TanStack Router**
- **Purpose**: Type-safe routing
- **Decentralization Fit**: ✅ HIGH (UI layer only)
- **Value**: Replace Next.js App Router with type-safe, framework-agnostic router
- **Verdict**: ⚠️ DEFER - Next.js App Router is working; migration cost high

---

#### ✅ Zod (STRONGLY RECOMMENDED)

**Purpose**: Runtime schema validation

**Current Pain**:
```typescript
// BROKEN: Manual validation, easy to miss edge cases
function parseInvite(payload: unknown): Invite {
  const p = payload as any;  // Dangerous cast
  return {
    groupId: p.groupId,  // Could be undefined, wrong type
    relayUrl: p.relayUrl,
  };
}
```

**With Zod**:
```typescript
// ROBUST: Schema enforcement + TypeScript inference
const InviteSchema = z.object({
  groupId: z.string().min(1),
  relayUrl: z.string().url(),
  roomKeyHex: z.string().regex(/^[a-f0-9]{64}$/i),
  expiresAtUnixMs: z.number().optional(),
});

function parseInvite(payload: unknown): Invite {
  return InviteSchema.parse(payload); // Throws on invalid, typesafe
}
```

**Decentralization Fit**: ✅ HIGH
- Validates untrusted relay data at boundaries
- Prevents malformed events from corrupting state
- Zero network assumptions

**Verdict**: ✅ ADOPT IMMEDIATELY - Critical for protocol security

**Adoption Priority**:
1. Nostr event parsing (`incoming-dm-event-handler.ts`)
2. Community invite/response validation
3. Profile data contracts
4. API boundary validation

---

#### ❌ Redis (NOT RECOMMENDED)

**Purpose**: In-memory cache, pub/sub, session store

**Why It Violates Core Principles**:

1. **Centralization**: Requires hosted Redis instance = single point of failure
2. **Privacy Risk**: User metadata in centralized cache breaks E2EE promise
3. **Operational Complexity**: New infrastructure to maintain, monitor, secure
4. **Offline Breakage**: PWA/offline mode can't reach Redis

**Alternative**: CRDT-based local cache with Nostr relay sync
```typescript
// Decentralized alternative: local-first + gossip sync
const localCache = createCRDTCache({
  persistence: IndexedDB,
  sync: { via: 'nostr-relay', filter: communityFilter }
});
```

**Verdict**: ❌ REJECT - Violates decentralization principle

**Exception**: Coordination service only
```typescript
// apps/coordination/ - Cloudflare Worker context only
// Redis could cache invite codes (ephemeral, non-sensitive)
// But Durable Objects or KV suffice
```

---

#### ⚠️ Prisma/ORM (DEFER)

**Purpose**: Database abstraction, type-safe queries

**Why Not Now**:
- Adds heavy dependency
- IndexedDB (current storage) doesn't need ORM
- Would require migration layer for existing data
- Overkill for key-value and document patterns used

**Verdict**: ⚠️ DEFER - Evaluate if switching to SQLite (via Tauri or Capacitor)

---

## Part 2: Safety & User Protection Architecture

### Design Constraints (Non-Negotiable)

1. **No Message Inspection**: Cannot scan message content (E2EE)
2. **No Metadata Surveillance**: Cannot track user behavior
3. **No Centralized Flagging**: Cannot phone home about "suspicious" users
4. **Voluntary**: User must opt-in to protection features
5. **Local-First**: Detection runs on-device, never sends data to servers

### Proposed: Local Safety Module

```typescript
// packages/core/src/safety/local-safety-module.ts
export interface LocalSafetyModule {
  // Scans incoming content BEFORE display, ON DEVICE
  // Uses local ML model (TensorFlow Lite, ONNX Runtime)
  
  analyzeContent(params: {
    content: string;
    senderPubkey: PublicKeyHex;
    context: 'dm' | 'community' | 'request';
  }): SafetyAnalysis;
}

interface SafetyAnalysis {
  // Risk scores (0-100), local computation only
  phishingProbability: number;      // URL analysis, patterns
  socialEngineeringScore: number;   // Urgency, manipulation language
  knownScamPatternMatch: boolean;     // Local hash DB of known scams
  
  // Warnings (shown to user, not sent anywhere)
  warnings: ReadonlyArray<{
    type: 'phishing' | 'scam' | 'social_engineering';
    severity: 'low' | 'medium' | 'high';
    message: string;  // Localized: "This message contains suspicious links"
    actions: ReadonlyArray<{
      label: string;
      action: 'block_sender' | 'report_to_community' | 'ignore';
    }>;
  }>;
}
```

### Data Sources (Privacy-Preserving)

**Option A: Local Blocklist (Recommended)**
```typescript
// Community-curated blocklists, fetched like software updates
const blocklist = await fetchCommunityBlocklist({
  source: 'community-voted',  // Not corporate
  verification: 'signed_by_trusted_peers',  // Web of trust
  localOnly: true,  // Never share what you blocked
});
```

**Option B: Local ML Model**
```typescript
// Model runs entirely on-device
// Downloaded like app update, not real-time inference API
const model = await loadLocalModel('/models/phishing-detection-v3.onnx');
const result = model.run({ content: message.text });  // Zero network
```

**Option C: Hash-Based Detection**
```typescript
// Bloom filter of known scam URLs/patterns
// Downloaded periodically, checked locally
const scamUrlFilter = await loadBloomFilter('/data/scam-urls-v2024-05.bin');
if (scamUrlFilter.mightContain(extractedUrl)) {
  showWarning({ type: 'suspicious_url', localCheck: true });
}
```

### Reputation System (Decentralized)

```typescript
// packages/core/src/safety/web-of-trust.ts
// NOT a centralized score - peer-to-peer attestation

interface WebOfTrust {
  // Users attest to peers they trust/distrust
  // Stored in Nostr events (kind 1984 for reports, kind 1985 for trust)
  // Visible only to those who care to look
  
  getTrustScore(params: {
    targetPubkey: PublicKeyHex;
    fromPerspectiveOf: PublicKeyHex;
    degrees: 1 | 2 | 3;  // Friend-of-friend depth
  }): TrustScore;
}

// Warning shows: "3 of your contacts have blocked this user"
// NOT: "This user has a trust score of 23 from our algorithm"
```

### Integration Points

```typescript
// apps/pwa/app/features/safety/components/safety-warning.tsx
function SafetyWarning({ analysis }: { analysis: SafetyAnalysis }) {
  if (analysis.warnings.length === 0) return null;
  
  return (
    <Alert variant={analysis.warnings[0].severity}>
      <AlertTitle>Safety Warning</AlertTitle>
      <AlertDescription>
        {analysis.warnings[0].message}
        <div className="mt-2">
          {analysis.warnings[0].actions.map(action => (
            <Button onClick={() => executeAction(action.action)}>
              {action.label}
            </Button>
          ))}
        </div>
      </AlertDescription>
      <div className="text-xs text-muted-foreground mt-2">
        Analysis performed locally on your device. No data was sent to servers.
      </div>
    </Alert>
  );
}
```

---

## Part 3: Local AI & Plugin Architecture

### Core Principle: User Sovereignty over AI

**Must Support**:
1. **No Mandatory AI**: App works fully without AI features
2. **Local-First**: AI runs on-device when possible (privacy)
3. **Optional External**: User can choose external API if they trust it
4. **Transparent**: User always knows when AI is processing their data
5. **Modular**: AI features as plugins/mods, not core dependencies

### Architecture: Plugin System

```typescript
// packages/core/src/plugins/plugin-system.ts
export interface PluginSystem {
  // Plugins are WASM modules or JS sandboxes
  // They declare capabilities and required permissions
  
  register(plugin: Plugin): void;
  
  // Capabilities granted by user
  permissions: {
    'message.read': boolean;      // Can read message content
    'message.send': boolean;      // Can send messages on user's behalf
    'storage.local': boolean;       // Can store data locally
    'network.external': boolean;  // Can make network requests
    'ai.local': boolean;          // Can use local ML
    'ai.external': boolean;       // Can use external AI APIs
  };
}

interface Plugin {
  id: string;
  name: string;
  version: string;
  capabilities: ReadonlyArray<PluginCapability>;
  
  // Sandboxed execution
  execute(context: PluginContext): void;
}

type PluginCapability =
  | { type: 'message_filter'; hook: 'pre_display' | 'post_receive' }
  | { type: 'command_handler'; commands: ReadonlyArray<string> }
  | { type: 'search_provider'; index: 'messages' | 'communities' | 'contacts' }
  | { type: 'ai_assistant'; model: 'local' | { external: string } };
```

### Example Plugins

**1. Local Search Bot** (High Privacy)
```typescript
// @obscur/plugin-local-search
const plugin: Plugin = {
  id: 'local-search',
  name: 'Local Message Search',
  capabilities: [{
    type: 'search_provider',
    index: 'messages',
    // Uses local SQLite FTS or IndexedDB
    // No network access
  }],
  permissions: { 'storage.local': true, 'message.read': true }
};
```

**2. AI Moderator Bot** (Community Installed)
```typescript
// @obscur/plugin-ai-moderator (community admin installs)
const plugin: Plugin = {
  id: 'ai-moderator',
  name: 'Community Content Assistant',
  capabilities: [{
    type: 'message_filter',
    hook: 'pre_display',
    // Local model flags potential issues
    // Community admin reviews, not auto-action
  }],
  permissions: { 'ai.local': true, 'message.read': true }
};
```

**3. External AI Assistant** (User Opts-In)
```typescript
// @obscur/plugin-openai-bridge (user chooses to install)
const plugin: Plugin = {
  id: 'openai-assistant',
  name: 'AI Message Assistant (OpenAI)',
  capabilities: [{
    type: 'ai_assistant',
    model: { external: 'https://api.openai.com/v1' }
  }],
  permissions: { 
    'ai.external': true, 
    'network.external': true,
    'message.read': true  // User explicitly grants
  }
};

// HUGE WARNING shown on install:
// "This plugin sends your messages to OpenAI's servers. 
//  OpenAI's privacy policy applies. 
//  Do you trust OpenAI with your data?"
```

### AI Execution Context

```typescript
interface AIContext {
  // What the AI can see
  visibleMessages: ReadonlyArray<Message>;  // Only what user explicitly shares
  
  // What the AI can do
  actions: {
    reply: (content: string) => Promise<void>;
    suggest: (suggestions: ReadonlyArray<string>) => void;
    search: (query: string) => Promise<SearchResult[]>;
  };
  
  // Guardrails
  constraints: {
    maxTokens: number;
    allowedTopics: ReadonlyArray<string>;
    prohibitedPatterns: ReadonlyArray<RegExp>;
  };
}
```

### Local AI Models

**ONNX Runtime Web** (Recommended)
```typescript
// Running LLM in browser via WASM
import * as ort from 'onnxruntime-web';

const session = await ort.InferenceSession.create(
  '/models/llama-2-7b-chat.Q4_K_M.gguf'
);

// ~4GB RAM required, runs on M1/M2 Macs, modern GPUs
// No network, no API keys, no data leaves device
```

**WebLLM (MLC LLM)**
```typescript
// https://webllm.mlc.ai/
import * as webllm from '@mlc-ai/web-llm';

const chat = new webllm.ChatModule();
await chat.reload('Llama-2-7b-chat-hf-q4f32_1');

const response = await chat.generate('Summarize this message', (msg) => {
  // Streaming response
});
```

**Constraints**:
- 2-7B parameter models only (browser memory limits)
- Quantized (4-bit) for size/speed
- No real-time training (read-only inference)

---

## Part 4: Sybil Attack Resistance

### The Problem

In decentralized systems with no identity provider:
- Bot farms create thousands of identities
- Spam, manipulation, reputation gaming
- No phone number/email to rate-limit

### Solution: Proof-of-Work + Web of Trust

**Not**: KYC, phone verification, government ID (violates privacy)
**Instead**: Economic cost + social graph validation

### 1. Identity Creation Cost

```typescript
// packages/core/src/identity/sybil-resistance.ts
// Creating an identity requires PoW or small payment

interface IdentityCreation {
  // Option A: Hashcash-style PoW
  proofOfWork: {
    difficulty: number;      // Adjustable based on network conditions
    nonce: string;            // Solution
    hash: string;             // SHA256(nonce + pubkey) < difficulty
  };
  
  // Option B: Lightning payment (optional, not required)
  lightningInvoice?: {
    amountSats: number;       // e.g., 100 sats = ~$0.05
    invoice: string;
    preimage: string;         // Proof of payment
  };
}

// Cost scales with abuse:
// Normal conditions: PoW takes ~10 seconds on average laptop
// Under attack: Difficulty increases, PoW takes ~5 minutes
```

### 2. Web of Trust Bootstrapping

```typescript
// New identities can't DM anyone until "vouched for"
// Vouching = existing user sends "trust" attestation

interface TrustAttestation {
  type: 'trust' | 'block' | 'report';
  targetPubkey: PublicKeyHex;
  // Signed by attestor
  signature: string;
}

// Network effect:
// - Bot creates 1000 identities
// - But no trusted users vouch for them
// - They can only interact with each other (isolated)
// - Can't reach real users

function canSendTo(params: {
  sender: PublicKeyHex;
  recipient: PublicKeyHex;
  webOfTrust: WebOfTrust;
}): boolean {
  // Has recipient (or someone recipient trusts) ever vouched for sender?
  const trustedByRecipient = webOfTrust
    .getTrustedBy(params.recipient, { degrees: 2 })
    .includes(params.sender);
    
  return trustedByRecipient;
}
```

### 3. Progressive Privileges

```typescript
// New identities have limited capabilities
interface PrivilegeLevel {
  sendDirectMessages: boolean;     // Requires 1 trust attestation
  createCommunities: boolean;      // Requires 3+ trust attestations, 7 days old
  sendMassInvites: boolean;        // Requires community admin status
  useAIPlugins: boolean;           // Requires 10+ messages, no reports
  exportData: boolean;             // Always allowed (user sovereignty)
}

// Bot farm problem:
// Creating 1000 identities doesn't help
// They need to be trusted by real humans to be useful
// Trust relationships take time and social capital
```

### 4. Rate Limiting (Per-Identity)

```typescript
// Already implemented in incoming-request-anti-abuse.ts
// Tightened for new identities

interface RateLimit {
  // Trusted identity: 20 requests per 2 minutes
  // New identity (< 7 days, < 3 trust attestations): 2 requests per 2 minutes
  
  peerLimit: number;        // Per-peer
  globalLimit: number;      // Across all peers
  windowMs: number;
  
  // Scales with reputation
  multiplier: number;       // 1.0 for new, 10.0 for established
}
```

### Sybil Resistance Summary

| Attack Vector | Defense | Decentralization Preserved |
|--------------|---------|---------------------------|
| Mass identity creation | PoW + Lightning cost | ✅ No identity provider |
| Spam after creation | Web of trust required | ✅ Social graph, not corporate |
| Reputation farming | Progressive privileges | ✅ Time + trust, not KYC |
| Rate limit evasion | Per-identity limits | ✅ No IP tracking |
| Account selling | Trust attestation revocation | ✅ Social relationships |

---

## Part 5: Implementation Roadmap

### Phase 1: Foundation (Weeks 1-6) - The Radical Overhaul

**Libraries**:
- [ ] Add Zod: Schema validation at all protocol boundaries
- [ ] Add TanStack Query: Replace custom caching chaos
- [ ] Add TanStack Virtual: Fix large list performance

**Architecture**:
- [ ] Eliminate `getActiveProfileIdSafe()` (60+ call sites)
- [ ] Profile-scoped message bus (replace `window.dispatchEvent`)
- [ ] Dependency injection container
- [ ] Package split: core / runtime / ui

**Validation**:
- [ ] Single-process A/B tests pass consistently
- [ ] No implicit global state
- [ ] Membership syncs via relay gossip

### Phase 2: Safety Module (Months 2-3)

**Local-First Safety**:
- [ ] Integrate ONNX Runtime Web
- [ ] Local phishing/scam detection model
- [ ] Community blocklist sync (signed, decentralized)
- [ ] Web of trust trust scores
- [ ] Safety warning UI components

**No**: Centralized scanning, mandatory reporting, content filtering
**Yes**: User-empowered, local analysis, opt-in protection

### Phase 3: Plugin System (Months 3-4)

**Core**:
- [ ] WASM plugin runtime
- [ ] Permission system
- [ ] Plugin store (signed packages)
- [ ] Sandboxed execution

**First Plugins**:
- [ ] Local search (no AI, just FTS)
- [ ] Simple command bots ("/weather", "/reminder")

### Phase 4: Local AI (Months 4-6)

**Infrastructure**:
- [ ] ONNX/MLC integration
- [ ] Model download/management
- [ ] GPU acceleration (WebGPU)

**Features**:
- [ ] Message summarization (local)
- [ ] Community moderation assistant (local)
- [ ] Historical search with semantic queries (local embeddings)

### Phase 5: Sybil Resistance (Months 5-6)

**Identity**:
- [ ] PoW difficulty adjustment
- [ ] Lightning payment option
- [ ] Web of trust attestation protocol

**Network**:
- [ ] Progressive privilege system
- [ ] Reputation-weighted rate limits
- [ ] Trust graph visualization

---

## Part 6: Rejected Technologies (And Why)

### ❌ Redis / Centralized Cache
- Violates decentralization
- Privacy risk (user metadata centralization)
- Operational burden
- Offline mode breakage

**Alternative**: Local-first CRDTs with Nostr sync

### ❌ Prisma / Traditional ORM
- Heavy dependency
- Not needed for document/key-value storage
- Migration complexity

**Alternative**: Dexie (IndexedDB wrapper) + Zod validation

### ❌ tRPC / GraphQL
- Designed for client-server architectures
- Doesn't map to relay-based gossip

**Alternative**: Nostr event kinds as the protocol

### ❌ Next.js API Routes
- Temptation to build backend logic
- Should be PWA-only, relays handle "backend"

**Alternative**: Cloudflare Workers for coordination only, everything else is client-side

### ❌ Firebase / Supabase / Similar
- Centralized
- Vendor lock-in
- Privacy nightmare

**Alternative**: Nostr relays (user chooses), local-first storage

---

## Decision Framework

When evaluating any new technology:

```
1. Does it require centralized infrastructure? ❌ REJECT
2. Does it send user data to external servers? ❌ REJECT
3. Does it work offline (PWA capability)? ❌ REJECT if no
4. Does it increase bundle size significantly? ⚠️ SCRUTINIZE
5. Is there a local-first alternative? ✅ PREFER
6. Can it be made optional (plugin)? ✅ PREFER
7. Does it align with user sovereignty? ✅ REQUIRE
```

---

## Final Recommendations

### Immediate Adoption (Week 1)
1. **Zod**: Runtime validation, critical for protocol security
2. **TanStack Query**: Replace custom cache chaos
3. **TanStack Virtual**: Performance win, zero tradeoffs

### Near-Term (Months 2-3)
4. **ONNX Runtime Web**: Local AI foundation
5. **Safety Module**: Local phishing/scam detection
6. **Plugin System**: WASM-based extensions

### Deferred
- Redis: Never (violates principles)
- Prisma: Not needed
- Heavy ML frameworks: Too large for web
- External AI APIs: Only as optional plugins with huge warnings

### Architecture Priority
The **radical overhaul** (Phase 1) must complete before adding new features. New libraries on broken architecture = more technical debt.

**Correct order**:
1. Fix architecture (explicit scope, DI, package split)
2. Add TanStack/Zod (better foundation)
3. Build safety/AI/plugins (on solid ground)

**Incorrect order**:
1. Add Redis (centralization)
2. Add AI features (on broken architecture)
3. Try to fix architecture later (impossible)

---

## Conclusion

The project can adopt **TanStack** and **Zod** immediately—they enhance the architecture without violating principles. **Redis** and centralized infrastructure must be rejected.

Safety and AI features must be **local-first, optional, and transparent**. Sybil resistance must use **economic and social costs**, not KYC.

**The radical overhaul is prerequisite.** Add features only after the foundation is solid.
