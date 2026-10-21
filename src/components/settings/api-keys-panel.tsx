"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Copy, KeyRound, Plus, ShieldOff } from "lucide-react";

import { createApiKey, revokeApiKey } from "@/app/(app)/app/settings/actions";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ApiKeyRow } from "@/lib/data/settings";
import { formatDateTime, relativeTime } from "@/lib/format";

const SCOPES = [
  { value: "score", label: "Score", hint: "Score a transaction before it settles." },
  { value: "ingest", label: "Ingest", hint: "Push transactions and counterparties." },
  { value: "read", label: "Read", hint: "Read alerts, cases and reports." },
] as const;

export function ApiKeysPanel({ keys, canManage }: { keys: ApiKeyRow[]; canManage: boolean }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [name, setName] = React.useState("");
  const [scopes, setScopes] = React.useState<string[]>(["score", "read"]);
  const [created, setCreated] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [revoking, setRevoking] = React.useState<ApiKeyRow | null>(null);

  const active = keys.filter((key) => !key.revokedAt);
  const revoked = keys.filter((key) => key.revokedAt);

  const submit = async () => {
    setPending(true);
    const result = await createApiKey({ name, scopes });
    setPending(false);
    if (!result.ok || !result.apiKey) {
      toast.error(result.message);
      return;
    }
    setCreated(result.apiKey);
    setName("");
    setScopes(["score", "read"]);
    router.refresh();
  };

  const copy = async () => {
    if (!created) return;
    await navigator.clipboard.writeText(created);
    setCopied(true);
    toast.success("Key copied to the clipboard.");
    window.setTimeout(() => setCopied(false), 2000);
  };

  const revoke = async () => {
    if (!revoking) return;
    setPending(true);
    const result = await revokeApiKey(revoking.id);
    setPending(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(result.message);
    setRevoking(null);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-xl text-xs text-muted-foreground">
          Keys authenticate the scoring API. Only a hash is stored, so a key can never be read again after creation.
        </p>
        {canManage ? (
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus aria-hidden="true" /> Create key
          </Button>
        ) : null}
      </div>

      {!canManage ? (
        <p className="rounded-card border border-border bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          Only administrators can create or revoke API keys.
        </p>
      ) : null}

      <section aria-labelledby="active-keys" className="rounded-card border border-border bg-card">
        <h2 id="active-keys" className="border-b border-border px-4 py-3 font-display text-sm font-semibold tracking-tight">
          Active keys ({active.length})
        </h2>
        {active.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">No live keys. Create one when you connect your first service.</p>
        ) : (
          <ul className="divide-y divide-border">
            {active.map((key) => (
              <li key={key.id} className="flex flex-wrap items-center gap-2 px-4 py-3 text-xs">
                <KeyRound className="size-4 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{key.name}</span>
                  <span className="num block text-[11px] text-muted-foreground">{key.prefix}…</span>
                </span>
                <span className="flex flex-wrap gap-1">
                  {key.scopes.map((scope) => (
                    <Badge key={scope} variant="outline" className="text-[11px]">
                      {scope}
                    </Badge>
                  ))}
                </span>
                <span className="num w-32 text-[11px] text-muted-foreground">
                  {key.lastUsedAt ? `used ${relativeTime(key.lastUsedAt)}` : "never used"}
                </span>
                {canManage ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-risk-critical hover:text-risk-critical"
                    onClick={() => setRevoking(key)}
                  >
                    <ShieldOff aria-hidden="true" /> Revoke
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {revoked.length > 0 ? (
        <section aria-labelledby="revoked-keys" className="rounded-card border border-border bg-card">
          <h2 id="revoked-keys" className="border-b border-border px-4 py-3 font-display text-sm font-semibold tracking-tight">
            Revoked ({revoked.length})
          </h2>
          <ul className="divide-y divide-border">
            {revoked.map((key) => (
              <li key={key.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-xs text-muted-foreground">
                <span className="min-w-0 flex-1 truncate">{key.name}</span>
                <span className="num">{key.prefix}…</span>
                <span className="num">revoked {key.revokedAt ? relativeTime(key.revokedAt) : "—"}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setCreated(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{created ? "Copy your key" : "Create an API key"}</DialogTitle>
            <DialogDescription>
              {created
                ? "This is the only time the secret is visible. Store it in your secret manager, not in code."
                : "Name the integration so you can tell keys apart when one needs to rotate."}
            </DialogDescription>
          </DialogHeader>

          {created ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-border bg-muted/60 p-3">
                <code className="num block break-all text-xs">{created}</code>
              </div>
              <Button size="sm" variant="outline" onClick={() => void copy()}>
                {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />} {copied ? "Copied" : "Copy key"}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="key-name" className="text-xs">Name</Label>
                <Input
                  id="key-name"
                  value={name}
                  maxLength={80}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Payments platform production"
                />
              </div>
              <fieldset className="space-y-2">
                <legend className="text-xs font-medium">Scopes</legend>
                {SCOPES.map((scope) => (
                  <label key={scope.value} className="flex items-start gap-2 rounded-lg border border-border px-3 py-2">
                    <Checkbox
                      checked={scopes.includes(scope.value)}
                      onCheckedChange={(checked) =>
                        setScopes((current) =>
                          checked === true
                            ? [...new Set([...current, scope.value])]
                            : current.filter((value) => value !== scope.value),
                        )
                      }
                      className="mt-0.5"
                      aria-label={`${scope.label} scope`}
                    />
                    <span>
                      <span className="block text-xs font-medium">{scope.label}</span>
                      <span className="block text-[11px] text-muted-foreground">{scope.hint}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
            </div>
          )}

          <DialogFooter>
            {created ? (
              <Button onClick={() => setOpen(false)}>Done</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                  Cancel
                </Button>
                <Button onClick={() => void submit()} disabled={pending || name.trim().length < 2 || scopes.length === 0}>
                  {pending ? "Creating…" : "Create key"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(revoking)}
        onOpenChange={(next) => {
          if (!next) setRevoking(null);
        }}
        title="Revoke this key?"
        description="Any service still using it starts receiving 401 responses immediately. This cannot be undone."
        confirmLabel="Revoke key"
        destructive
        confirmPhrase={revoking?.name}
        pending={pending}
        onConfirm={() => void revoke()}
      >
        {revoking ? (
          <p className="num text-xs text-muted-foreground">
            {revoking.prefix}… created {formatDateTime(revoking.createdAt)}
          </p>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}
