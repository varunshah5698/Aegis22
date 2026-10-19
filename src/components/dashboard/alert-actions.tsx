"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowUpRight, FolderPlus, Send } from "lucide-react";

import { addAlertNote, assignAlert, createCaseFromAlert, updateAlertStatus } from "@/app/(app)/app/alerts/actions";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { nextStatuses, STATUS_LABELS } from "@/lib/alerts/transitions";
import type { AlertStatus } from "@/lib/data/alerts";

export function AlertActions({
  alertId,
  status,
  assigneeId,
  members,
  role,
}: {
  alertId: string;
  status: AlertStatus;
  assigneeId: string | null;
  members: Array<{ id: string; full_name: string; email: string }>;
  role: string;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [caseTitle, setCaseTitle] = React.useState("");
  const [showCase, setShowCase] = React.useState(false);
  const readOnly = role === "viewer";
  const options = nextStatuses(status);

  const run = async (action: () => Promise<{ ok: boolean; message: string; caseId?: string }>, after?: (result: { caseId?: string }) => void) => {
    setPending(true);
    const result = await action();
    setPending(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(result.message);
    after?.(result);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      {readOnly ? (
        <p className="rounded-card border border-border bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          Your viewer role is read-only. Ask an analyst or administrator to change this alert.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Assignee</Label>
              <Select
                value={assigneeId ?? "unassigned"}
                onValueChange={(value) =>
                  void run(() => assignAlert(alertId, value === "unassigned" ? null : value))
                }
                disabled={pending}
              >
                <SelectTrigger className="h-9 w-52">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {members.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.full_name || member.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap gap-2">
              {options.length === 0 ? (
                <p className="text-xs text-muted-foreground">This alert is closed. Reopen it from an investigation if needed.</p>
              ) : (
                options.map((next) => (
                  <Button
                    key={next}
                    size="sm"
                    variant={next === "investigating" ? "accent" : "outline"}
                    disabled={pending}
                    onClick={() => {
                      const note =
                        next === "resolved" || next === "false_positive"
                          ? window.prompt("Add a short resolution note (optional)") ?? undefined
                          : undefined;
                      void run(() => updateAlertStatus(alertId, next, note));
                    }}
                  >
                    {STATUS_LABELS[next]}
                  </Button>
                ))
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="alert-note" className="text-xs">Add a note</Label>
            <Textarea
              id="alert-note"
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="What did you check, and what did you conclude?"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                disabled={pending || note.trim().length < 2}
                onClick={() =>
                  void run(() => addAlertNote(alertId, note), () => setNote(""))
                }
              >
                <Send aria-hidden="true" /> Add note
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowCase((value) => !value)}>
                <FolderPlus aria-hidden="true" /> Create case
              </Button>
            </div>
          </div>

          {showCase ? (
            <div className="rounded-card border border-border p-3">
              <Label htmlFor="case-title" className="text-xs">Case title</Label>
              <div className="mt-1 flex gap-2">
                <Input
                  id="case-title"
                  value={caseTitle}
                  onChange={(event) => setCaseTitle(event.target.value)}
                  placeholder="Review structuring cluster on PK-MM"
                />
                <Button
                  size="sm"
                  disabled={pending || caseTitle.trim().length < 3}
                  onClick={() =>
                    void run(() => createCaseFromAlert(alertId, caseTitle), (result) => {
                      if (result.caseId) router.push(`/app/cases/${result.caseId}`);
                    })
                  }
                >
                  Open
                </Button>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                The case links this alert, its transaction and your notes.
              </p>
            </div>
          ) : null}
        </>
      )}

      <Button variant="ghost" size="sm" asChild className="px-0">
        <Link href="/app/network">
          Inspect the network <ArrowUpRight aria-hidden="true" />
        </Link>
      </Button>
    </div>
  );
}
