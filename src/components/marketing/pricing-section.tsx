"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Minus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { comparisonGroups, pricingTiers } from "@/content/marketing";
import { cn } from "@/lib/utils";

const tierColumns = [
  { key: "starter", label: "Starter" },
  { key: "growth", label: "Growth" },
  { key: "enterprise", label: "Enterprise" },
] as const;

function Price({ monthly, annual, billing }: { monthly: number | null; annual: number | null; billing: "monthly" | "annual" }) {
  if (monthly === null || annual === null) {
    return <span className="font-display text-3xl font-semibold tracking-tight">Custom</span>;
  }
  const amount = billing === "monthly" ? monthly : annual;
  return (
    <span className="flex items-baseline gap-1">
      <span className="font-display text-3xl font-semibold tracking-tight">${amount.toLocaleString("en-US")}</span>
      <span className="text-sm text-muted-foreground">/ month</span>
    </span>
  );
}

export function PricingSection({ compact = false }: { compact?: boolean }) {
  const [billing, setBilling] = React.useState<"monthly" | "annual">("annual");

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Label htmlFor="billing-toggle" className="text-sm">
            {billing === "annual" ? "Annual billing" : "Monthly billing"}
          </Label>
          <Switch
            id="billing-toggle"
            checked={billing === "annual"}
            onCheckedChange={(checked) => setBilling(checked ? "annual" : "monthly")}
            aria-describedby="billing-hint"
          />
          <span id="billing-hint" className="rounded-pill bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
            Save 20% annually
          </span>
        </div>
        <p className="text-xs text-muted-foreground">Prices exclude tax. Cancel any time.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {pricingTiers.map((tier) => (
          <div
            key={tier.id}
            className={cn(
              "flex flex-col rounded-hero border-2 p-6",
              "highlighted" in tier && tier.highlighted
                ? "border-foreground bg-foreground text-background shadow-lift"
                : "border-foreground/15 bg-card",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-xl font-semibold tracking-tight">{tier.name}</h3>
                <p className={cn("mt-1 text-sm", "highlighted" in tier && tier.highlighted ? "text-background/70" : "text-muted-foreground")}>
                  {tier.tagline}
                </p>
              </div>
              {"highlighted" in tier && tier.highlighted ? (
                <span className="rounded-pill bg-accent px-2.5 py-1 text-[11px] font-medium text-accent-foreground">
                  Most chosen
                </span>
              ) : null}
            </div>

            <div className="mt-6">
              <Price monthly={tier.monthly} annual={tier.annual} billing={billing} />
              <p className={cn("mt-1 text-xs", "highlighted" in tier && tier.highlighted ? "text-background/60" : "text-muted-foreground")}>
                {billing === "annual" ? "Billed annually" : "Billed monthly"} · {tier.volume}
              </p>
            </div>

            <ul className="mt-6 flex-1 space-y-2.5 text-sm">
              {tier.features.map((feature) => (
                <li key={feature} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-risk-low" aria-hidden="true" />
                  <span className={cn("highlighted" in tier && tier.highlighted ? "text-background/85" : "text-foreground/85")}>
                    {feature}
                  </span>
                </li>
              ))}
            </ul>

            <p className={cn("mt-5 text-xs", "highlighted" in tier && tier.highlighted ? "text-background/60" : "text-muted-foreground")}>
              {tier.seats} · {tier.support}
            </p>

            <Button
              asChild
              className="mt-4 w-full"
              variant={"highlighted" in tier && tier.highlighted ? "accent" : "outline"}
            >
              <Link href={tier.href}>{tier.cta}</Link>
            </Button>
          </div>
        ))}
      </div>

      {compact ? null : (
        <div className="overflow-x-auto rounded-hero border border-border">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <caption className="sr-only">Plan comparison</caption>
            <thead>
              <tr className="bg-muted/60">
                <th scope="col" className="px-4 py-3 text-left font-medium">Included</th>
                {tierColumns.map((column) => (
                  <th key={column.key} scope="col" className="px-4 py-3 text-center font-medium">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparisonGroups.map((group) => (
                <React.Fragment key={group.title}>
                  <tr>
                    <th
                      scope="rowgroup"
                      colSpan={4}
                      className="border-t border-border bg-background px-4 pb-1 pt-4 text-left text-[12px] font-semibold text-muted-foreground"
                    >
                      {group.title}
                    </th>
                  </tr>
                  {group.rows.map((row) => (
                    <tr key={row.label} className="border-t border-border/60">
                      <th scope="row" className="px-4 py-2.5 text-left font-normal text-foreground/85">
                        {row.label}
                      </th>
                      {tierColumns.map((column) => {
                        const value = row[column.key];
                        return (
                          <td key={column.key} className="px-4 py-2.5 text-center">
                            {value ? (
                              <Check className="mx-auto size-4 text-risk-low" aria-hidden="true" />
                            ) : (
                              <Minus className="mx-auto size-4 text-muted-foreground/60" aria-hidden="true" />
                            )}
                            <span className="sr-only">
                              {value ? "Included" : "Not included"} in {column.label}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
