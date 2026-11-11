import { AuthDoor } from "./auth/AuthDoor";
import { createLabDeviceUnlockPort, LAB_AUTH_DOOR_DEFAULTS } from "./auth/lab-device-unlock-port";
import { resolveDesktopUiDeviceUnlockPort } from "./auth/resolve-device-unlock-port";
import { createVitePassphraseDeviceUnlockHandlers, readViteIdentityRecord } from "./auth/vite-passphrase-device-unlock";
import { createViteNativeDeviceUnlockPort } from "./auth/vite-native-device-unlock";
import { createLabContinuityPorts } from "./continuity/lab-continuity-ports";
import { resolveDesktopUiContinuityPorts } from "./continuity/resolve-continuity-ports";
import { createViteContinuityPorts } from "./continuity/vite-continuity-ports";
import { createLabPrivateTrustHomePorts } from "./private-trust/lab-private-trust-ports";
import { createNativePrivateTrustHomePorts } from "./private-trust/native-private-trust-ports";
import { PrivateTrustHome } from "./private-trust/PrivateTrustHome";
import { resolveDesktopUiPrivateTrustHomePorts } from "./private-trust/resolve-private-trust-ports";
import { createViteHomeEnvelopeDeliver } from "./private-trust/vite-private-dc-session";
import {
  detectDesktopUiNativeRuntime,
  readDesktopUiLabStubsForced,
} from "./runtime/desktop-ui-adapter-selection";
import { createViteTauriEngineHost } from "./runtime/vite-tauri-engine-host";

/**
 * Cut 4.4 / 8–11 — prefer-native App + Continuity + product-depth Auth/Home.
 * Lab stubs only when OBSCUR_DESKTOP_UI_LAB_STUBS=1 or host absent.
 * Soft L3 / Continuity Pass not claimed.
 */

const forceLabStubs = readDesktopUiLabStubsForced();
const isNativeRuntime = detectDesktopUiNativeRuntime();
const profileId = LAB_AUTH_DOOR_DEFAULTS.profileId;
const identity = readViteIdentityRecord(profileId);
/** Empty device → AuthDoor create path (Cut 11); do not invent LAB pubkey as product identity. */
const expectedPublicKeyHex = (identity?.publicKeyHex
  ?? (forceLabStubs || !isNativeRuntime
    ? LAB_AUTH_DOOR_DEFAULTS.expectedPublicKeyHex
    : "")) as typeof LAB_AUTH_DOOR_DEFAULTS.expectedPublicKeyHex;

const labDeviceUnlock = createLabDeviceUnlockPort({
  acceptedPassphrase: LAB_AUTH_DOOR_DEFAULTS.acceptedPassphrase,
  publicKeyHex: expectedPublicKeyHex,
});

const nativeDeviceUnlock = createViteNativeDeviceUnlockPort(
  createVitePassphraseDeviceUnlockHandlers(),
);

const resolvedDeviceUnlock = resolveDesktopUiDeviceUnlockPort({
  isNativeRuntime,
  forceLabStubs,
  labPort: labDeviceUnlock,
  nativePort: nativeDeviceUnlock,
});

const labPrivateTrustPorts = createLabPrivateTrustHomePorts({ preferPrivateDc: true });

const nativePrivateTrustPorts = isNativeRuntime
  ? createNativePrivateTrustHomePorts({
    host: createViteTauriEngineHost(),
    profileId,
    preferPrivateDc: true,
    deliverHomeEnvelope: createViteHomeEnvelopeDeliver({ profileId }),
  })
  : labPrivateTrustPorts;

const resolvedPrivateTrust = resolveDesktopUiPrivateTrustHomePorts({
  isNativeRuntime,
  forceLabStubs,
  labPorts: labPrivateTrustPorts,
  nativePorts: nativePrivateTrustPorts,
});

/** Cut 8.4 — Continuity prefer-native (vite seal) vs lab stub. */
const labContinuityPorts = createLabContinuityPorts();
const viteContinuityPorts = createViteContinuityPorts({ profileId });
const resolvedContinuity = resolveDesktopUiContinuityPorts({
  isNativeRuntime,
  forceLabStubs,
  labPorts: labContinuityPorts,
  nativePorts: viteContinuityPorts,
});

export function App() {
  return (
    <main className="shell shell-wide">
      <AuthDoor
        profileId={profileId}
        expectedPublicKeyHex={expectedPublicKeyHex}
        deviceUnlock={resolvedDeviceUnlock.port}
        renderShell={({ onLock }) => (
          <PrivateTrustHome
            ports={resolvedPrivateTrust.ports}
            continuityPorts={resolvedContinuity.ports}
            profileId={profileId}
            onLock={onLock}
          />
        )}
      />
    </main>
  );
}
