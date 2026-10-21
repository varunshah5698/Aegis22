import { AlertCircle, ArrowRightLeft, MessageSquare, UserPlus } from "lucide-react";

interface TimelineEvent {
  id: string;
  event_type: string;
  actorName: string | null;
  payload: unknown;
  created_at: string;
}

const icons: Record<string, typeof MessageSquare> = {
  created: AlertCircle,
  assigned: UserPlus,
  status_changed: ArrowRightLeft,
  escalated: ArrowRightLeft,
  note_added: MessageSquare,
  exported: ArrowRightLeft,
};

function describe(event: TimelineEvent): string {
  const payload = (event.payload ?? {}) as Record<string, unknown>;
  if (event.event_type === "note_added" && typeof payload.note === "string") return payload.note;
  if (event.event_type === "status_changed" && payload.from && payload.to) {
    return `Status changed from ${String(payload.from).replace(/_/g, " ")} to ${String(payload.to).replace(/_/g, " ")}.`;
  }
  if (event.event_type === "escalated") return "Alert escalated for a second review.";
  if (event.event_type === "assigned") return payload.assignee_id ? "Assignee updated." : "Assignment cleared.";
  if (event.event_type === "created") return "Alert created by the scoring engine.";
  return event.event_type.replace(/_/g, " ");
}

export function AlertTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">No activity recorded yet.</p>;
  }

  return (
    <ol className="relative space-y-4 border-l border-border pl-5">
      {events.map((event) => {
        const Icon = icons[event.event_type] ?? AlertCircle;
        return (
          <li key={event.id} className="relative">
            <span className="absolute -left-[27px] flex size-4 items-center justify-center rounded-full bg-card ring-1 ring-border">
              <Icon className="size-2.5 text-muted-foreground" aria-hidden="true" />
            </span>
            <p className="text-xs">{describe(event)}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {event.actorName ?? "System"} ·{" "}
              {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(
                new Date(event.created_at),
              )}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
