"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserMinus } from "lucide-react";

import { removeMember, updateMemberRole } from "@/app/(app)/app/settings/actions";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TeamMember } from "@/lib/data/settings";
import { formatDate } from "@/lib/format";
import { initials } from "@/lib/utils";

const ROLES = [
  { value: "admin", label: "Admin", hint: "Full control: team, rules, keys, audit log." },
  { value: "analyst", label: "Analyst", hint: "Investigate alerts, cases, notes and reports." },
  { value: "viewer", label: "Viewer", hint: "Read-only access to every workspace view." },
] as const;

export function TeamTable({
  members,
  canEdit,
  currentUserId,
}: {
  members: TeamMember[];
  canEdit: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [target, setTarget] = React.useState<TeamMember | null>(null);

  const changeRole = async (member: TeamMember, role: "admin" | "analyst" | "viewer") => {
    setPendingId(member.id);
    const result = await updateMemberRole(member.id, role);
    setPendingId(null);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(result.message);
    router.refresh();
  };

  const remove = async () => {
    if (!target) return;
    setPendingId(target.id);
    const result = await removeMember(target.id);
    setPendingId(null);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(result.message);
    setTarget(null);
    router.refresh();
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Roles decide what a person can change. The audit log records every role change with the actor and timestamp.
      </p>

      <div className="overflow-x-auto rounded-card border border-border bg-card">
        <table className="w-full min-w-[640px] text-left text-sm">
          <caption className="sr-only">People with access to this workspace.</caption>
          <thead className="border-b border-border bg-muted/40 text-[11.5px] text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-2 font-medium">Member</th>
              <th scope="col" className="px-3 py-2 font-medium">Role</th>
              <th scope="col" className="px-3 py-2 font-medium">Joined</th>
              <th scope="col" className="px-4 py-2 text-right font-medium">Access</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => {
              const isSelf = member.id === currentUserId;
              return (
                <tr key={member.id} className="border-b border-border/60 last:border-0">
                  <th scope="row" className="px-4 py-3 text-left font-normal">
                    <div className="flex items-center gap-2">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-accent-foreground">
                        {initials(member.fullName || member.email)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-medium">{member.fullName || member.email}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">{member.email}</span>
                      </span>
                      {isSelf ? <Badge variant="outline" className="text-[11px]">You</Badge> : null}
                    </div>
                  </th>
                  <td className="px-3 py-3">
                    {canEdit ? (
                      <Select
                        value={member.role}
                        onValueChange={(value) => void changeRole(member, value as typeof member.role)}
                        disabled={pendingId === member.id}
                      >
                        <SelectTrigger className="h-8 w-32 text-xs" aria-label={`Role for ${member.email}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((role) => (
                            <SelectItem key={role.value} value={role.value}>
                              {role.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="capitalize text-xs">{member.role}</span>
                    )}
                  </td>
                  <td className="num px-3 py-3 text-xs text-muted-foreground">{formatDate(member.joinedAt)}</td>
                  <td className="px-4 py-3 text-right">
                    {canEdit && !isSelf ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pendingId === member.id}
                        onClick={() => setTarget(member)}
                        className="text-risk-critical hover:text-risk-critical"
                      >
                        <UserMinus aria-hidden="true" /> Remove
                      </Button>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">{isSelf ? "Your account" : "—"}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <dl className="grid gap-2 sm:grid-cols-3">
        {ROLES.map((role) => (
          <div key={role.value} className="rounded-card border border-border bg-card p-3">
            <dt className="text-xs font-medium">{role.label}</dt>
            <dd className="mt-0.5 text-[11px] leading-5 text-muted-foreground">{role.hint}</dd>
          </div>
        ))}
      </dl>

      <ConfirmDialog
        open={Boolean(target)}
        onOpenChange={(open) => {
          if (!open) setTarget(null);
        }}
        title={`Remove ${target?.email ?? "member"}?`}
        description="They lose access to this workspace immediately. Their prior case notes, alerts and audit entries stay attributed to them."
        confirmLabel="Remove access"
        destructive
        confirmPhrase={target ? target.email : undefined}
        pending={Boolean(target && pendingId === target.id)}
        onConfirm={() => void remove()}
      />
    </div>
  );
}
