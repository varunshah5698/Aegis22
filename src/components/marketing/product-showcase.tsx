"use client";

import { ArrowUpRight, CircleAlert, GitBranch, Layers, ShieldAlert } from "lucide-react";

import { RiskBadge } from "@/components/risk-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { demoCorridors, demoTransactions } from "@/content/demo";
import { cn } from "@/lib/utils";

function PanelFrame({ title, meta, children }: { title: string; meta: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-hero border-2 border-foreground/15 bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <p className="font-display text-sm font-semibold tracking-tight">{title}</p>
        <p className="num text-xs text-muted-foreground">{meta}</p>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function OverviewMock() {
  const series = [32, 38, 34, 44, 41, 52, 48, 57, 54, 64, 61, 72, 69, 78, 74, 86];
  const points = series
    .map((value, index) => `${(index / (series.length - 1)) * 100},${70 - (value / 90) * 58}`)
    .join(" ");

  return (
    <PanelFrame title="Overview" meta="Last 24 hours · UTC">
      <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Scanned", value: "12,438" },
              { label: "Flagged", value: "186", tone: "text-risk-high" },
              { label: "Open alerts", value: "34", tone: "text-risk-medium" },
            ].map((item) => (
              <div key={item.label} className="rounded-card border border-border p-3">
                <p className="text-[11px] text-muted-foreground">{item.label}</p>
                <p className={cn("mt-1 font-display text-lg font-semibold tracking-tight num", item.tone)}>
                  {item.value}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-card border border-border p-3">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Transactions by hour</span>
              <span className="inline-flex items-center gap-1 text-risk-low">
                <ArrowUpRight className="size-3" aria-hidden="true" /> 4.2%
              </span>
            </div>
            <svg viewBox="0 0 100 72" className="mt-2 h-24 w-full" role="img" aria-label="Transaction volume rises through the day, with a spike in the last six hours.">
              <defs>
                <linearGradient id="showcaseArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F0B250" stopOpacity="0.55" />
                  <stop offset="100%" stopColor="#F0B250" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              <polygon points={`0,72 ${points} 100,72`} fill="url(#showcaseArea)" />
              <polyline points={points} fill="none" stroke="#14151A" strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" className="stroke-foreground" />
            </svg>
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Top corridors by risk</p>
          {demoCorridors.slice(0, 4).map((corridor) => (
            <div key={`${corridor.sender}-${corridor.receiver}`} className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2">
              <div>
                <p className="num text-xs font-medium">{corridor.sender}→{corridor.receiver}</p>
                <p className="text-[10px] text-muted-foreground">{corridor.flagged} flagged</p>
              </div>
              <span className="num text-sm font-semibold" style={{ color: corridor.score >= 70 ? "#F26B3A" : "#F5B83D" }}>
                {corridor.score}
              </span>
            </div>
          ))}
        </div>
      </div>
    </PanelFrame>
  );
}

function AlertsMock() {
  const alerts = demoTransactions.filter((row) => row.score >= 47).slice(0, 4);
  return (
    <PanelFrame title="Alerts" meta="34 open · 6 breaching SLA">
      <ul className="space-y-2">
        {alerts.map((alert, index) => (
          <li key={alert.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border/70 px-3 py-2.5">
            <RiskBadge level={alert.level} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">Splitting window on {alert.corridor} for {alert.sender}</p>
              <p className="num text-[10px] text-muted-foreground">{alert.id} · {alert.amount.toLocaleString("en-US")} {alert.currency}</p>
            </div>
            <span
              className={cn(
                "num rounded-pill px-2 py-0.5 text-[10px]",
                index === 0
                  ? "bg-risk-critical/15 text-risk-critical"
                  : index === 1
                    ? "bg-risk-medium/20 text-[#6b4a00] dark:text-risk-medium"
                    : "bg-risk-low/15 text-risk-low",
              )}
            >
              {index === 0 ? "SLA breached" : index === 1 ? "2h 40m left" : "9h left"}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center gap-4 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1"><ShieldAlert className="size-3.5" aria-hidden="true" /> 3 assigned to you</span>
        <span className="inline-flex items-center gap-1"><CircleAlert className="size-3.5" aria-hidden="true" /> 2 escalated</span>
      </div>
    </PanelFrame>
  );
}

function NetworkMock() {
  const nodes = [
    { id: "a", x: 18, y: 34, r: 15, tone: "#E5484D" },
    { id: "b", x: 48, y: 20, r: 11, tone: "#F26B3A" },
    { id: "c", x: 72, y: 38, r: 13, tone: "#F5B83D" },
    { id: "d", x: 46, y: 56, r: 9, tone: "#F26B3A" },
    { id: "e", x: 84, y: 62, r: 7, tone: "#2FBF71" },
    { id: "f", x: 24, y: 62, r: 8, tone: "#F5B83D" },
  ];
  const edges = [
    ["a", "b"], ["b", "c"], ["c", "a"], ["b", "d"], ["d", "e"], ["d", "f"], ["a", "d"],
  ];
  const byId = new Map(nodes.map((node) => [node.id, node]));

  return (
    <PanelFrame title="Network" meta="72-hour window · 6 entities">
      <svg viewBox="0 0 100 80" className="h-56 w-full" role="img" aria-label="Funds move from an originator through two intermediaries and return to the originator within three hops.">
        {edges.map(([from, to]) => {
          const a = byId.get(from!)!;
          const b = byId.get(to!)!;
          const circular = (from === "a" && to === "c") || (from === "c" && to === "a");
          return (
            <line
              key={`${from}-${to}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={circular ? "#E5484D" : "#8A8F9C"}
              strokeWidth={circular ? 0.7 : 0.45}
              strokeDasharray={circular ? "2 1.4" : undefined}
            />
          );
        })}
        {nodes.map((node) => (
          <g key={node.id}>
            <circle cx={node.x} cy={node.y} r={node.r / 3} fill={node.tone} opacity="0.18" />
            <circle cx={node.x} cy={node.y} r={node.r / 5} fill={node.tone} />
          </g>
        ))}
      </svg>
      <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><GitBranch className="size-3.5" aria-hidden="true" /> 3-hop cycle detected</span>
        <span>Largest node: 42,900 USD</span>
      </div>
    </PanelFrame>
  );
}

function StructuringMock() {
  const amounts = [9_350, 9_440, 9_530, 9_620, 9_710, 9_800];
  const threshold = 10_000;

  return (
    <PanelFrame title="Structuring" meta="7 transactions · 2 related accounts">
      <div className="space-y-3">
        <div className="relative h-32 rounded-card border border-border p-3">
          <div className="absolute inset-x-3 top-[38%] border-t border-dashed border-risk-critical/70" />
          <span className="absolute right-3 top-[30%] text-[10px] text-risk-critical">10,000 threshold</span>
          <div className="flex h-full items-end gap-2">
            {amounts.map((amount, index) => (
              <div key={amount} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-accent/80"
                  style={{ height: `${(amount / threshold) * 72}px` }}
                />
                <span className="num text-[9px] text-muted-foreground">{index + 1}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-[11px]">
          <div className="rounded-lg bg-muted p-2">
            <p className="text-muted-foreground">Cluster total</p>
            <p className="num mt-0.5 font-semibold">57,450 USD</p>
          </div>
          <div className="rounded-lg bg-muted p-2">
            <p className="text-muted-foreground">Window</p>
            <p className="num mt-0.5 font-semibold">22 hours</p>
          </div>
          <div className="rounded-lg bg-muted p-2">
            <p className="text-muted-foreground">Accounts</p>
            <p className="num mt-0.5 font-semibold">2 related</p>
          </div>
        </div>
        <p className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Layers className="size-3.5" aria-hidden="true" />
          Each transfer stays 6% below the threshold; the cluster crosses it.
        </p>
      </div>
    </PanelFrame>
  );
}

const tabs = [
  { value: "overview", label: "Overview", panel: <OverviewMock /> },
  { value: "alerts", label: "Alerts", panel: <AlertsMock /> },
  { value: "network", label: "Network", panel: <NetworkMock /> },
  { value: "structuring", label: "Structuring", panel: <StructuringMock /> },
] as const;

export function ProductShowcase() {
  return (
    <Tabs defaultValue="overview">
      <TabsList aria-label="Product views" className="flex-wrap">
        {tabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value}>
          {tab.panel}
        </TabsContent>
      ))}
    </Tabs>
  );
}
