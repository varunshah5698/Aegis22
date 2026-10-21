"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, ArrowRight, FolderPlus, Search, ShieldAlert } from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { appNav, settingsNav } from "@/config/site";

interface SearchResults {
  transactions: Array<{ id: string; external_id: string; sender_name: string; risk_level: string | null }>;
  alerts: Array<{ id: string; title: string; severity: string; status: string }>;
  cases: Array<{ id: string; title: string; status: string }>;
  rules: Array<{ id: string; name: string; status: string }>;
  entities: Array<{ id: string; legal_name: string; country: string; kind: string }>;
}

const emptyResults: SearchResults = { transactions: [], alerts: [], cases: [], rules: [], entities: [] };

const RECENT_KEY = "aegis-recent";

export function CommandPalette({ userId }: { userId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResults>(emptyResults);
  const [recent, setRecent] = React.useState<Array<{ label: string; href: string }>>([]);

  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(`${RECENT_KEY}:${userId}`);
      if (stored) setRecent(JSON.parse(stored) as Array<{ label: string; href: string }>);
    } catch {
      // Ignore malformed storage.
    }
  }, [userId]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("sf:open-command", onOpen);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("sf:open-command", onOpen);
    };
  }, []);

  React.useEffect(() => {
    if (!open) return;
    if (query.trim().length < 2) {
      setResults(emptyResults);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`, {
          signal: controller.signal,
        });
        if (!response.ok) return;
        const payload = (await response.json()) as { data: SearchResults | null };
        setResults(payload.data ?? emptyResults);
      } catch {
        // Aborted or offline: keep the previous results.
      }
    }, 220);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, query]);

  const go = (href: string, label?: string) => {
    if (label) {
      const next = [{ label, href }, ...recent.filter((item) => item.href !== href)].slice(0, 6);
      setRecent(next);
      window.localStorage.setItem(`${RECENT_KEY}:${userId}`, JSON.stringify(next));
    }
    setOpen(false);
    setQuery("");
    router.push(href);
  };

  const pages: Array<{ label: string; href: string }> = [
    ...appNav.flatMap((group) => group.items.map(({ label, href }) => ({ label, href }))),
    ...settingsNav.map(({ label, href }) => ({ label, href })),
  ];

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Search and commands">
      <CommandInput
        placeholder="Search transactions, alerts, cases, entities…"
        value={query}
        onValueChange={setQuery}
        aria-label="Search workspace"
      />
      <CommandList>
        <CommandEmpty>
          {query.length < 2 ? "Type at least two characters to search." : "No matching records."}
        </CommandEmpty>

        {recent.length > 0 && query.length === 0 ? (
          <CommandGroup heading="Recent">
            {recent.map((item) => (
              <CommandItem key={item.href} value={`recent-${item.href}`} onSelect={() => go(item.href)}>
                <Search className="size-4" aria-hidden="true" />
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        <CommandGroup heading="Pages">
          {pages.map((page) => (
            <CommandItem key={page.href} value={`page-${page.href}`} onSelect={() => go(page.href, page.label)}>
              <ArrowRight className="size-4" aria-hidden="true" />
              {page.label}
            </CommandItem>
          ))}
        </CommandGroup>

        {results.transactions.length > 0 ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="Transactions">
              {results.transactions.map((row) => (
                <CommandItem
                  key={row.id}
                  value={`tx-${row.id}`}
                  onSelect={() => go(`/app/transactions?tx=${row.id}`, row.external_id)}
                >
                  <ArrowLeftRight className="size-4" aria-hidden="true" />
                  <span className="num">{row.external_id}</span>
                  <span className="truncate text-xs text-muted-foreground">{row.sender_name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}

        {results.alerts.length > 0 ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="Alerts">
              {results.alerts.map((row) => (
                <CommandItem key={row.id} value={`alert-${row.id}`} onSelect={() => go(`/app/alerts/${row.id}`, row.title)}>
                  <ShieldAlert className="size-4" aria-hidden="true" />
                  <span className="truncate">{row.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}

        {results.cases.length > 0 ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="Cases">
              {results.cases.map((row) => (
                <CommandItem key={row.id} value={`case-${row.id}`} onSelect={() => go(`/app/cases/${row.id}`, row.title)}>
                  {row.title}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}

        {results.rules.length > 0 ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="Rules">
              {results.rules.map((row) => (
                <CommandItem key={row.id} value={`rule-${row.id}`} onSelect={() => go(`/app/rules/${row.id}`, row.name)}>
                  {row.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}

        {results.entities.length > 0 ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="Entities">
              {results.entities.map((row) => (
                <CommandItem
                  key={row.id}
                  value={`entity-${row.id}`}
                  onSelect={() => go(`/app/network?entity=${row.id}`, row.legal_name)}
                >
                  {row.legal_name}
                  <span className="ml-auto text-xs text-muted-foreground">{row.country}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}

        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem value="action-new-case" onSelect={() => go("/app/cases?new=1", "New case")}>
            <FolderPlus className="size-4" aria-hidden="true" />
            Create case
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
