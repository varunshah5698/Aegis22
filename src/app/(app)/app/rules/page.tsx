import type { Metadata } from "next";

import { PageShell } from "@/components/app/page-shell";
import { RuleList } from "@/components/dashboard/rule-list";
import { EmptyState } from "@/components/states";
import { canPublishRules, requireOrganization } from "@/lib/auth";
import { listRules } from "@/lib/data/rules";

export const metadata: Metadata = { title: "Rules" };

export default async function RulesPage() {
  const { supabase, profile, organization } = await requireOrganization();
  const rules = await listRules(supabase, organization!.id);
  const canPublish = canPublishRules(profile.role);

  const active = rules.filter((rule) => rule.status === "active").length;
  const drafts = rules.filter((rule) => rule.status === "draft").length;

  return (
    <PageShell
      eyebrow="Configure / Detection"
      title="Rules"
      description="Deterministic checks that run alongside the risk model at ingestion. Every change is versioned and written to the audit log."
      meta={
        <>
          <span className="num">{rules.length} rules</span>
          <span className="num text-risk-low">{active} active</span>
          <span className="num">{drafts} draft</span>
          <span>{canPublish ? "You can publish changes" : "Read-only for your role"}</span>
        </>
      }
    >
      {rules.length === 0 ? (
        <EmptyState
          title="No rules configured"
          description="Import the starter rule set or ask an administrator to create one."
        />
      ) : (
        <RuleList rules={rules} canPublish={canPublish} />
      )}

      <p className="text-[11px] leading-4 text-muted-foreground">
        Publishing swaps the live version in one step, keeps the previous version for audit, and opens a fresh draft so
        the next change is explicit.
      </p>
    </PageShell>
  );
}
