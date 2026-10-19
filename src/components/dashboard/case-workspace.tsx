"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Send } from "lucide-react";

import {
  addCaseNote,
  assignCaseOwner,
  linkAlertToCase,
  setCasePriority,
  setCaseStatus,
} from "@/app/(app)/app/cases/actions";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CASE_PRIORITIES,
  CASE_PRIORITY_LABELS,
  CASE_STATUS_LABELS,
  CASE_STATUSES,
  type CasePriority,
  type CaseStatus,
} from "@/lib/cases/types";

export function CaseWorkspace({
  caseId,
  status,
  priority,
  ownerId,
  owners,
  role,
}: {
  caseId: string;
  status: CaseStatus;
  priority: CasePriority;
  ownerId: string | null;
  owners: Array<{ id: string; full_name: string; email: string }>;
  role: string;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [alertId, setAlertId] = React.useState("");
  const readOnly = role === "viewer";

  const run = async (action: () => Promise<{ ok: boolean; message: string }>, reset?: () => void) => {
    setPending(true);
    const result = await action();
    setPending(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(result.message);
    reset?.();
    router.refresh();
  };

  return (
    <div className="space-y-4">
      {readOnly ? (
        <p className="rounded-card border border-border bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          Your viewer role can read this case file but not change it.
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select
                value={status}
                onValueChange={(value) => void run(() => setCaseStatus(caseId, value as CaseStatus))}
                disabled={pending}
              >
                <SelectTrigger className="h-9" aria-label="Case status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CASE_STATUSES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {CASE_STATUS_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Priority</Label>
              <Select
                value={priority}
                onValueChange={(value) => void run(() => setCasePriority(caseId, value as CasePriority))}
                disabled={pending}
              >
                <SelectTrigger className="h-9" aria-label="Case priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CASE_PRIORITIES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {CASE_PRIORITY_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Owner</Label>
            <Select
              value={ownerId ?? "unassigned"}
              onValueChange={(value) => void run(() => assignCaseOwner(caseId, value === "unassigned" ? null : value))}
              disabled={pending}
            >
              <SelectTrigger className="h-9" aria-label="Case owner">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {owners.map((owner) => (
                  <SelectItem key={owner.id} value={owner.id}>
                    {owner.full_name || owner.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 border-t border-border pt-4">
            <Label htmlFor="case-note" className="text-xs">Add to the case file</Label>
            <Textarea
              id="case-note"
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Evidence reviewed, counterparties contacted, decision taken…"
              maxLength={10_000}
            />
            <Button
              size="sm"
              disabled={pending || note.trim().length < 2 || status === "closed"}
              onClick={() => void run(() => addCaseNote(caseId, note), () => setNote(""))}
            >
              <Send aria-hidden="true" /> Add note
            </Button>
          </div>

          <div className="space-y-2 border-t border-border pt-4">
            <Label htmlFor="link-alert" className="text-xs">Link an alert by id</Label>
            <div className="flex gap-2">
              <Input
                id="link-alert"
                value={alertId}
                onChange={(event) => setAlertId(event.target.value)}
                placeholder="Alert UUID"
                className="h-9"
              />
              <Button
                size="sm"
                variant="outline"
                disabled={pending || alertId.trim().length < 8}
                onClick={() => void run(() => linkAlertToCase(caseId, alertId.trim()), () => setAlertId(""))}
              >
                Link
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
