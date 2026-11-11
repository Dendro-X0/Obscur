import { useState, type ReactNode } from "react";
import { Button } from "@dweb/ui-kit/button";
import { cn } from "@dweb/ui-kit/cn";

/**
 * OB4 — product door chrome for Settings / Private home / Continuity.
 * Methods available ≠ Continuity Pass · Soft L3 paused.
 */

export type ProductDoorId = "settings" | "home" | "continuity";

export type ProductDoorsProps = Readonly<{
  settings: ReactNode;
  home: ReactNode;
  continuity: ReactNode | null;
}>;

const DOORS: ReadonlyArray<Readonly<{ id: ProductDoorId; label: string }>> = [
  { id: "settings", label: "Settings" },
  { id: "home", label: "Private home" },
  { id: "continuity", label: "Continuity" },
];

export function ProductDoors(props: ProductDoorsProps) {
  const [active, setActive] = useState<ProductDoorId>("settings");
  const available = DOORS.filter((door) => (
    door.id !== "continuity" || props.continuity !== null
  ));

  return (
    <section className="product-doors" data-testid="product-doors">
      <header className="product-doors-header">
        <h2>Product doors</h2>
        <p className="lede">
          Settings and Continuity are product doors on remaster ports — Continuity methods
          available ≠ Continuity Pass · Soft L3 paused.
        </p>
      </header>
      <div
        className="product-doors-tabs"
        role="tablist"
        aria-label="Product doors"
      >
        {available.map((door) => (
          <Button
            key={door.id}
            type="button"
            role="tab"
            aria-selected={active === door.id}
            data-testid={`product-door-tab-${door.id}`}
            variant={active === door.id ? "primary" : "outline"}
            size="sm"
            onClick={() => setActive(door.id)}
          >
            {door.label}
          </Button>
        ))}
      </div>
      <div
        role="tabpanel"
        className={cn("product-doors-panel")}
        data-testid={`product-door-panel-${active}`}
      >
        {active === "settings" ? props.settings : null}
        {active === "home" ? props.home : null}
        {active === "continuity" ? props.continuity : null}
      </div>
    </section>
  );
}
