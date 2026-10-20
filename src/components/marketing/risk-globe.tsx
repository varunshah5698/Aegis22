"use client";

import * as React from "react";
import {
  ArrowUpRight,
  CircleDollarSign,
  GitBranch,
  ShieldAlert,
  TriangleAlert,
  X,
} from "lucide-react";

import { EarthGlobe, type GlobeFocus } from "@/components/globe/earth-globe";
import { latLonToVector3, vector3ToLatLon } from "@/lib/globe/geo";
import {
  DEMO_GLOBE_TRANSFERS,
  GLOBE_DEMO_LABEL,
  GLOBE_KIND_COLOR,
  GLOBE_KIND_LABEL,
  formatObservedAgo,
  type GlobeEventKind,
  type GlobeTransfer,
} from "@/lib/globe/transactions";
import { formatCurrency } from "@/lib/utils";

type CardKey = "structuring" | "corridor" | "circular";

const CARDS: Array<{
  key: CardKey;
  eyebrow: string;
  badge: string;
  title: string;
  meta: string;
  selectId: string;
  tone: GlobeEventKind;
  icon: typeof ShieldAlert;
  score?: number;
  meter?: number;
}> = [
  {
    key: "structuring",
    eyebrow: "Structuring",
    badge: "High",
    title: "7 payments under threshold",
    meta: "SG → HK · 6h window · 3 related accounts",
    selectId: "singapore-hongkong-structuring",
    tone: "structuring",
    icon: ShieldAlert,
    meter: 84,
  },
  {
    key: "corridor",
    eyebrow: "New corridor",
    badge: "Critical",
    title: "NG → AE · first transfer",
    meta: "$48,200 · PEP-linked counterparty",
    selectId: "lagos-dubai-corridor",
    tone: "corridor",
    icon: TriangleAlert,
    score: 92,
  },
  {
    key: "circular",
    eyebrow: "Circular flow",
    badge: "Critical",
    title: "A → B → C → A",
    meta: "$212,400 returned in 61 hours",
    selectId: "zurich-singapore-loop",
    tone: "circular",
    icon: GitBranch,
  },
];

const LEGEND: Array<{ color: string; label: string; dashed?: boolean }> = [
  { color: GLOBE_KIND_COLOR.cleared, label: "Cleared" },
  { color: GLOBE_KIND_COLOR.elevated, label: "Elevated risk" },
  { color: GLOBE_KIND_COLOR.corridor, label: "Critical" },
  { color: "#8a98ac", label: "Dashed = structuring / loop", dashed: true },
];

const RISK_COLOR: Record<GlobeTransfer["riskLevel"], string> = {
  low: "#2dd4bf",
  medium: "#f0b250",
  high: "#fb923c",
  critical: "#f85149",
};

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
 * Every card is bound to a demo transfer by id, and every transfer carries
 * city coordinates. Selecting a card (or a route on the globe) lights the same
 * geographic corridor, eases the planet toward it and opens the evidence panel.
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
        critical, with dashed routes for structuring and circular flows. Select a transaction card
        to trace its corridor.
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

      {selected ? (
        <TransferDetail transfer={selected} onClose={clear} />
      ) : null}

      <div className="globe-cards" aria-label="Flagged transaction examples">
        {CARDS.map((card, index) => {
          const Icon = card.icon;
          const pressed = selected !== null && card.selectId === selected.id;
          return (
            <button
              key={card.key}
              type="button"
              aria-pressed={pressed}
              onClick={() => setSelectedId((current) => (current === card.selectId ? null : card.selectId))}
              className={`globe-card globe-card--${["a", "b", "c"][index]} ${
                pressed ? "is-active" : ""
              }`}
              style={{ "--card-accent": GLOBE_KIND_COLOR[card.tone] } as React.CSSProperties}
            >
              <span className="globe-card__head">
                {card.score ? (
                  <span className="globe-card__score num" aria-label={`Risk score ${card.score}`}>
                    {card.score}
                  </span>
                ) : (
                  <span className="globe-card__icon" aria-hidden="true">
                    <Icon className="size-3.5" strokeWidth={1.8} />
                  </span>
                )}
                <span className="globe-card__label">{card.eyebrow}</span>
                <span className="globe-card__badge">{card.badge}</span>
              </span>

              <span className="globe-card__title">{card.title}</span>
              <span className="globe-card__meta">{card.meta}</span>

              {card.meter ? (
                <span className="globe-card__meter" aria-hidden="true">
                  <span style={{ width: `${card.meter}%` }} />
                </span>
              ) : null}

              <ArrowUpRight className="globe-card__open" aria-hidden="true" />
            </button>
          );
        })}
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

function TransferDetail({ transfer, onClose }: { transfer: GlobeTransfer; onClose: () => void }) {
  const accent = GLOBE_KIND_COLOR[transfer.kind];
  const riskColor = RISK_COLOR[transfer.riskLevel];

  return (
    <section
      className="globe-detail"
      style={{ "--detail-accent": accent } as React.CSSProperties}
      aria-label={`Transaction ${transfer.reference}`}
    >
      <div className="globe-detail__head">
        <span className="globe-detail__kind">
          <span className="globe-detail__dot" aria-hidden="true" />
          {GLOBE_KIND_LABEL[transfer.kind]}
        </span>
        <span className="globe-detail__ref num">{transfer.reference}</span>
        <button type="button" className="globe-detail__close" onClick={onClose} aria-label="Close transaction detail">
          <X className="size-3.5" aria-hidden="true" />
        </button>
      </div>

      <p className="globe-detail__route">
        {transfer.from.city}
        <span className="globe-detail__arrow" aria-hidden="true">
          →
        </span>
        {transfer.to.city}
      </p>
      <p className="globe-detail__corridor num">
        {transfer.from.country} → {transfer.to.country} · observed {formatObservedAgo(transfer.observedMinutesAgo)}
      </p>

      <div className="globe-detail__numbers">
        <div>
          <span className="globe-detail__key">Amount</span>
          <span className="globe-detail__value num">
            {formatCurrency(transfer.amountUsd, transfer.currency, { maximumFractionDigits: 0 })}
          </span>
        </div>
        <div>
          <span className="globe-detail__key">Risk score</span>
          <span className="globe-detail__value num" style={{ color: riskColor }}>
            {transfer.riskScore} · {transfer.riskLevel}
          </span>
        </div>
      </div>

      <p className="globe-detail__classification">{transfer.classification}</p>
      <p className="globe-detail__note">{transfer.note}</p>

      <p className="globe-detail__footnote">
        Simulated event · no customer, account or payment identifiers
      </p>
    </section>
  );
}
