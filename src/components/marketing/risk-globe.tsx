"use client";

import * as React from "react";
import { CircleDollarSign } from "lucide-react";

import { EarthGlobe, type GlobeFocus } from "@/components/globe/earth-globe";
import { latLonToVector3, vector3ToLatLon } from "@/lib/globe/geo";
import {
  DEMO_GLOBE_TRANSFERS,
  GLOBE_DEMO_LABEL,
  GLOBE_KIND_COLOR,
  type GlobeTransfer,
} from "@/lib/globe/transactions";

const LEGEND: Array<{ color: string; label: string; dashed?: boolean }> = [
  { color: GLOBE_KIND_COLOR.cleared, label: "Cleared" },
  { color: GLOBE_KIND_COLOR.elevated, label: "Elevated risk" },
  { color: GLOBE_KIND_COLOR.corridor, label: "Critical" },
  { color: "#8a98ac", label: "Dashed = structuring / loop", dashed: true },
];

function focusFor(transfers: GlobeTransfer[]): GlobeFocus | null {
  if (transfers.length === 0) return null;
  const mean = latLonToVector3(0, 0, 0);
  for (const transfer of transfers) {
    mean.add(latLonToVector3(transfer.from.lat, transfer.from.lon));
    mean.add(latLonToVector3(transfer.to.lat, transfer.to.lon));
  }
  if (mean.lengthSq() < 1e-8) return null;
  return vector3ToLatLon(mean.normalize());
}

/**
 * The hero globe.
 *
 * Every route is a demo transfer carrying real city coordinates. Selecting a
 * route on the globe lights its corridor and eases the planet toward it.
 */
export function RiskGlobe() {
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const transfers = DEMO_GLOBE_TRANSFERS;

  const selected = React.useMemo(
    () => transfers.find((transfer) => transfer.id === selectedId) ?? null,
    [selectedId, transfers],
  );

  const activeTransfers = React.useMemo(() => {
    if (!selected) return [];
    return selected.flowId
      ? transfers.filter((transfer) => transfer.flowId === selected.flowId)
      : [selected];
  }, [selected, transfers]);

  const activeIds = React.useMemo(
    () => activeTransfers.map((transfer) => transfer.id),
    [activeTransfers],
  );
  const focus = React.useMemo(() => focusFor(activeTransfers), [activeTransfers]);

  const select = React.useCallback((id: string) => setSelectedId(id), []);
  const clear = React.useCallback(() => setSelectedId(null), []);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="globe-hero">
      <p className="sr-only">
        A rotating three-dimensional Earth showing simulated cross-border transfers, plotted between
        real cities. Routes are coloured by risk: teal for cleared, amber for elevated, red for
        critical, with dashed routes for structuring and circular flows.
      </p>

      <div className="globe-canvas">
        <EarthGlobe
          transfers={transfers}
          activeIds={activeIds}
          focus={focus}
          onSelect={select}
          onClear={clear}
        />
      </div>

      <div className="globe-footer">
        <ul className="globe-legend" aria-label="Route colour legend">
          {LEGEND.map((item) => (
            <li key={item.label}>
              <span
                className={item.dashed ? "globe-legend__dash" : "globe-legend__line"}
                style={{ borderColor: item.color, background: item.color }}
                aria-hidden="true"
              />
              {item.label}
            </li>
          ))}
        </ul>

        <span className="globe-demo">
          <CircleDollarSign className="size-3.5" aria-hidden="true" />
          {GLOBE_DEMO_LABEL}
        </span>
      </div>

      <p className="globe-hint">Drag to rotate · scroll or pinch to zoom · select a flow to trace it</p>
    </div>
  );
}
