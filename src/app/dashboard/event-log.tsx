"use client";

import { useCallback, useEffect, useState } from "react";
import { Fragment } from "react";
import { getEventLog, type EventLogEntry } from "./actions";

interface EventLogProps {
  initialEvents: EventLogEntry[];
}

const statusStyles: Record<string, string> = {
  received: "bg-slate-700/60 text-slate-300",
  processed: "bg-emerald-500/15 text-emerald-300",
  skipped: "bg-sky-500/15 text-sky-300",
  failed: "bg-red-500/15 text-red-300",
};

function issueTitle(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const issue = (payload as { issue?: unknown }).issue;
  if (!issue || typeof issue !== "object") return null;
  const title = (issue as { title?: unknown }).title;
  return typeof title === "string" ? title : null;
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(value));
}

export function EventLog({ initialEvents }: EventLogProps) {
  const [events, setEvents] = useState(initialEvents);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      setEvents(await getEventLog());
      setRefreshError(null);
    } catch {
      setRefreshError("Could not refresh the activity log.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  return (
    <section className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Activity Log</h2>
          <p className="text-sm text-slate-400 mt-1">Recent GitHub events and automation actions</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-2 text-xs text-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Live · checks every 5 seconds
          </span>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={refreshing}
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-slate-700 cursor-pointer"
          >
            {refreshing ? "Refreshing…" : "Refresh now"}
          </button>
        </div>
      </div>

      {refreshError && <p role="status" className="text-sm text-amber-300">{refreshError}</p>}

      {events.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">
          No events yet — open an issue on a connected repo to see it here
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-3 font-medium">Received</th>
                <th className="px-3 py-3 font-medium">Repository</th>
                <th className="px-3 py-3 font-medium">Event</th>
                <th className="px-3 py-3 font-medium">Issue</th>
                <th className="px-3 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {events.map((event) => {
                const isExpanded = Boolean(expanded[event.id]);
                const title = issueTitle(event.payload);
                return (
                  <Fragment key={event.id}>
                    <tr
                      key={event.id}
                      tabIndex={0}
                      aria-expanded={isExpanded}
                      onClick={() => setExpanded((current) => ({ ...current, [event.id]: !current[event.id] }))}
                      onKeyDown={(keyboardEvent) => {
                        if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
                          keyboardEvent.preventDefault();
                          setExpanded((current) => ({ ...current, [event.id]: !current[event.id] }));
                        }
                      }}
                      className="cursor-pointer hover:bg-slate-800/40 focus-visible:outline focus-visible:outline-indigo-400"
                    >
                      <td className="whitespace-nowrap px-3 py-3 text-slate-400">{formatTimestamp(event.receivedAt)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-200">{event.connectedRepo.fullName}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-300">{event.eventType}{event.action ? ` / ${event.action}` : ""}</td>
                      <td className="max-w-xs truncate px-3 py-3 text-slate-400">{title ?? "—"}</td>
                      <td className="px-3 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[event.status] ?? statusStyles.received}`}>
                          {event.status}
                        </span>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${event.id}-details`}>
                        <td colSpan={5} className="px-4 pb-4 pt-2">
                          {event.botActions.length ? (
                            <ul className="space-y-2">
                              {event.botActions.map((botAction) => (
                                <li key={botAction.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 text-sm">
                                  <span className={botAction.success ? "text-emerald-300" : "text-red-300"}>
                                    {botAction.success ? "Success" : "Failed"}
                                  </span>
                                  <span className="text-slate-200">{botAction.type}</span>
                                  {botAction.error && <span className="text-red-300">{botAction.error}</span>}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-slate-500">No actions recorded for this event.</p>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
