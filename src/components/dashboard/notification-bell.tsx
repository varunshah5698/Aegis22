"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface NotificationRow {
  id: string;
  title: string;
  body: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
  type: string;
}

export function NotificationBell({ userId }: { userId: string }) {
  const [rows, setRows] = React.useState<NotificationRow[]>([]);
  const [open, setOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as { data: { notifications: NotificationRow[] } | null };
      setRows(payload.data?.notifications ?? []);
    } catch {
      // Keep the previous list when offline.
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          setRows((current) => [payload.new as NotificationRow, ...current].slice(0, 20));
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  const unread = rows.filter((row) => !row.read_at);
  const markAllRead = async () => {
    setRows((current) => current.map((row) => ({ ...row, read_at: row.read_at ?? new Date().toISOString() })));
    await fetch("/api/notifications", { method: "POST" });
  };

  const today = rows.filter((row) => new Date(row.created_at).toDateString() === new Date().toDateString());
  const earlier = rows.filter((row) => new Date(row.created_at).toDateString() !== new Date().toDateString());

  const renderRow = (row: NotificationRow) => (
    <li key={row.id}>
      <Link
        href={row.link ?? "/app/overview"}
        onClick={() => setOpen(false)}
        className={cn(
          "block rounded-lg px-3 py-2.5 transition-colors hover:bg-muted",
          !row.read_at && "bg-accent/10",
        )}
      >
        <p className="text-xs font-medium">{row.title}</p>
        {row.body ? <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{row.body}</p> : null}
        <p className="mt-1 text-[10px] text-muted-foreground">
          {new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(new Date(row.created_at))}
        </p>
      </Link>
    </li>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={unread.length ? `${unread.length} unread notifications` : "Notifications"}>
          <span className="relative">
            <Bell aria-hidden="true" />
            {unread.length > 0 ? (
              <span className="num absolute -right-2 -top-2 flex min-w-4 items-center justify-center rounded-full bg-risk-critical px-1 text-[9px] font-semibold leading-4 text-white">
                {unread.length > 99 ? "99+" : unread.length}
              </span>
            ) : null}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Notifications</p>
          <Button variant="ghost" size="sm" onClick={markAllRead} disabled={unread.length === 0}>
            <CheckCheck aria-hidden="true" /> Mark all read
          </Button>
        </div>
        <div className="max-h-96 overflow-y-auto p-2">
          {rows.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">Nothing yet. Alerts and mentions appear here.</p>
          ) : (
            <>
              {today.length > 0 ? (
                <div>
                  <p className="px-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Today</p>
                  <ul className="mt-1">{today.map(renderRow)}</ul>
                </div>
              ) : null}
              {earlier.length > 0 ? (
                <div className="mt-2">
                  <p className="px-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Earlier</p>
                  <ul className="mt-1">{earlier.map(renderRow)}</ul>
                </div>
              ) : null}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
