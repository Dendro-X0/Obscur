import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CommunityActionWaitRing } from "./community-action-wait-ring";
import { buildCommunityActionWaitSteps } from "./community-action-wait-types";

describe("buildCommunityActionWaitSteps", () => {
  const defs = [
    { id: "local", label: "Local" },
    { id: "relay", label: "Relay" },
    { id: "directory", label: "Directory" },
  ] as const;

  it("marks steps before active as done", () => {
    const steps = buildCommunityActionWaitSteps(defs, "relay");
    expect(steps.map((s) => s.status)).toEqual(["done", "active", "pending"]);
  });

  it("marks all done when allComplete", () => {
    const steps = buildCommunityActionWaitSteps(defs, null, { allComplete: true });
    expect(steps.every((s) => s.status === "done")).toBe(true);
  });
});

describe("CommunityActionWaitRing", () => {
  it("renders title and step labels", () => {
    const steps = buildCommunityActionWaitSteps(
      [
        { id: "local", label: "Local exit" },
        { id: "relay", label: "Relay proof" },
      ],
      "local",
    );
    render(
      <CommunityActionWaitRing
        title="Leaving community"
        subtitle="Finishing on this device first."
        steps={steps}
      />,
    );
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByTestId("community-action-wait-steps")).toBeTruthy();
    expect(screen.getByText("Leaving community")).toBeTruthy();
    expect(screen.getByText("Local exit")).toBeTruthy();
    expect(screen.getByText("Relay proof")).toBeTruthy();
  });

  it("keeps step copy in an upright list, not on a rotating orbit container", () => {
    const steps = buildCommunityActionWaitSteps(
      [{ id: "local", label: "Local keys" }],
      "local",
    );
    const { container } = render(
      <CommunityActionWaitRing title="Creating workspace" steps={steps} />,
    );
    expect(container.querySelector(".obscur-community-action-orbit-ring")).toBeTruthy();
    expect(container.querySelector(".obscur-community-action-orbit")).toBeNull();
    expect(container.querySelector('[data-testid="community-action-wait-steps"]')).toBeTruthy();
  });
});
