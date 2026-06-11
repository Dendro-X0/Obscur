/**
 * Fail-loud native SQLite write probe for Dev Lab / CDP gates.
 * Delegates to dm-kernel write port (sole native DM write boundary).
 */

import {
  probeDmKernelWrite,
  type DmKernelWriteResult,
} from "@/app/features/dm-kernel/dm-kernel-write-port";

export type NativeDmSqliteWriteProbeResult = DmKernelWriteResult;

/** CDP / Dev Lab gate — roundtrip insert + read before DM scenarios. */
export const probeNativeDmSqliteWrite = probeDmKernelWrite;
