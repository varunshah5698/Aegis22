"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function AuditFilters({
  actions,
  members,
  active,
}: {
  actions: string[];
  members: Array<{ id: string; label: string }>;
  active: { action?: string | undefined; actor?: string | undefined };
}) {
  const router = useRouter();

  const navigate = (patch: { action?: string | undefined; actor?: string | undefined }) => {
    const next = { ...active, ...patch };
    const params = new URLSearchParams();
    if (next.action) params.set("action", next.action);
    if (next.actor) params.set("actor", next.actor);
    const suffix = params.toString();
    router.push(`/app/settings/audit-log${suffix ? `?${suffix}` : ""}`);
  };

  const filtered = Boolean(active.action || active.actor);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={active.action ?? "all"} onValueChange={(value) => navigate({ action: value === "all" ? undefined : value })}>
        <SelectTrigger className="h-9 w-52" aria-label="Filter by action">
          <SelectValue placeholder="All actions" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All actions</SelectItem>
          {actions.map((action) => (
            <SelectItem key={action} value={action}>
              {action}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={active.actor ?? "all"} onValueChange={(value) => navigate({ actor: value === "all" ? undefined : value })}>
        <SelectTrigger className="h-9 w-52" aria-label="Filter by member">
          <SelectValue placeholder="Everyone" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Everyone</SelectItem>
          {members.map((member) => (
            <SelectItem key={member.id} value={member.id}>
              {member.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {filtered ? (
        <Button size="sm" variant="ghost" onClick={() => router.push("/app/settings/audit-log")}>
          Clear filters
        </Button>
      ) : null}
    </div>
  );
}
