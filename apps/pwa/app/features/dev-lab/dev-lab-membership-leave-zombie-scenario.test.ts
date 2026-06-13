import { describe, expect, it } from "vitest";
import { evaluateMembershipLeaveZombieScenario } from "./dev-lab-membership-leave-zombie-scenario";

describe("dev-lab-membership-leave-zombie-scenario", () => {
  it("passes all leave zombie repair gate cases", () => {
    const scenario = evaluateMembershipLeaveZombieScenario();
    expect(scenario.ok).toBe(true);
    expect(scenario.cases.map((entry) => entry.id)).toEqual([
      "intentional_leave_outbox_blocks_repair",
      "stale_directory_without_outbox_may_repair",
      "directory_terminal_left_blocks_repair",
      "directory_inactive_blocks_repair",
    ]);
  });
});
