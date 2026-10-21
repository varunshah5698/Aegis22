"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, Pause, Play, Rocket } from "lucide-react";

import { publishRule, setRuleStatus } from "@/app/(app)/app/rules/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RiskBadge } from "@/components/risk-badge";
import type { RuleRow } from "@/lib/data/rules";
import { describeGroup, type DescribedGroup } from "@/lib/rules/describe";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

function Group({ group, depth = 0 }: { group: DescribedGroup; depth?: number }) {
  return (
    <div className={cn(depth > 0 && "rounded-[6px] border border-border/70 bg-card px-3 py-2")}>
      <p className="label-xs mb-1.5">{group.logic === "and" ? "All of" : "Any of"}</p>
      <ul className="space-y-1">
        {group.items.map((item, index) => (
          <li key={index} className="text-xs">
            {item.kind === "condition" ? (
              <span className="flex items-start gap-2">
                <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-foreground/40" />
                <span className="text-[12px]">{item.text}</span>
              </span>
            ) : (
              <Group group={item.group} depth={depth + 1} />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

const statusTone: Record<RuleRow["status"], string> = {
  active: "bg-risk-low/15 text-risk-low",
  draft: "bg-risk-medium/20 text-[#6b4a00] dark:text-risk-medium",
  disabled: "bg-muted text-muted-foreground",
};

export function RuleList({ rules, canPublish }: { rules: RuleRow[]; canPublish: boolean }) {
  const router = useRouter();
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  const run = async (ruleId: string, action: () => Promise<{ ok: boolean; message: string }>) => {
    setPendingId(ruleId);
    const result = await action();
    setPendingId(null);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(result.message);
    router.refresh();
  };

  return (
    <ul className="space-y-3">
      {rules.map((rule) => {
        const latest = rule.versions[0];
        const draft = rule.versions.find((version) => version.isDraft);
        const busy = pendingId === rule.id;
        const live = rule.versions.find((version) => version.version === rule.currentVersion) ?? latest;

        return (
          <li key={rule.id} className="panel">
            <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3.5">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[14px] font-semibold tracking-[-0.01em]">{rule.name}</h2>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-[5px] px-1.5 py-0.5 text-[11px] font-medium",
                      statusTone[rule.status],
                    )}
                  >
                    <span className="size-1.5 rounded-full bg-current opacity-70" aria-hidden="true" />
                    {rule.status === "active" ? "Active" : rule.status === "draft" ? "Draft" : "Disabled"}
                  </span>
                  {rule.currentVersion ? (
                    <span className="num text-[11px] text-muted-foreground">v{rule.currentVersion} live</span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">never published</span>
                  )}
                  {live?.definition.actions ? (
                    <RiskBadge level={live.definition.actions.severity} />
                  ) : null}
                </div>
                <p className="max-w-2xl text-xs leading-5 text-muted-foreground">{rule.description}</p>
                <p className="num text-[11px] text-muted-foreground">
                  {rule.alertCount.toLocaleString("en-US")} alerts attributed · updated {relativeTime(rule.updatedAt)}
                </p>
              </div>

              {canPublish ? (
                <div className="flex flex-wrap items-center gap-2">
                  {draft ? (
                    <Button
                      size="sm"
                      className="h-8 text-[12px]"
                      disabled={busy}
                      onClick={() => void run(rule.id, () => publishRule(rule.id))}
                    >
                      <Rocket aria-hidden="true" className="size-3.5" /> Publish v{draft.version}
                    </Button>
                  ) : null}
                  {rule.status === "active" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-[12px]"
                      disabled={busy}
                      onClick={() => void run(rule.id, () => setRuleStatus(rule.id, "disabled"))}
                    >
                      <Pause aria-hidden="true" className="size-3.5" /> Disable
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-[12px]"
                      disabled={busy || !rule.currentVersion}
                      onClick={() => void run(rule.id, () => setRuleStatus(rule.id, "active"))}
                    >
                      <Play aria-hidden="true" className="size-3.5" /> Enable
                    </Button>
                  )}
                </div>
              ) : (
                <Badge variant="outline" className="text-[11px]">
                  Admin only
                </Badge>
              )}
            </div>

            <div className="grid gap-4 border-t border-border/60 bg-muted/20 px-4 py-3.5 md:grid-cols-2">
              <section aria-label={`Conditions for ${rule.name}`}>
                <p className="label-xs mb-2">{live ? `Version ${live.version} logic` : "Logic"}</p>
                {live ? <Group group={describeGroup(live.definition.root)} /> : null}
                {live?.definition.actions ? (
                  <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
                    On match: raise a {live.definition.actions.severity} alert, add{" "}
                    {live.definition.actions.scorePoints} risk points
                    {live.definition.actions.tags.length > 0 ? `, tag ${live.definition.actions.tags.join(", ")}` : ""}.
                  </p>
                ) : null}
              </section>

              <section aria-label={`Version history for ${rule.name}`}>
                <details className="group">
                  <summary className="label-xs flex cursor-pointer items-center gap-1">
                    Version history ({rule.versions.length})
                    <ChevronDown className="size-3 transition-transform group-open:rotate-180" aria-hidden="true" />
                  </summary>
                  <ol className="mt-2 space-y-2">
                    {rule.versions.map((version) => (
                      <li key={version.id} className="rounded-[6px] border border-border/70 bg-card px-3 py-2 text-[12px]">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="num font-medium">v{version.version}</span>
                          <span
                            className={cn(
                              "rounded-[5px] px-1.5 py-0.5 text-[11px] font-medium",
                              version.isDraft ? "bg-risk-medium/15 text-risk-medium" : "bg-risk-low/15 text-risk-low",
                            )}
                          >
                            {version.isDraft ? "draft" : "published"}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {version.publishedAt ? relativeTime(version.publishedAt) : relativeTime(version.createdAt)}
                            {version.publishedByName ? ` · ${version.publishedByName}` : ""}
                          </span>
                        </div>
                        {version.changeNote ? (
                          <p className="mt-1 text-[11px] text-muted-foreground">{version.changeNote}</p>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                </details>
              </section>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
