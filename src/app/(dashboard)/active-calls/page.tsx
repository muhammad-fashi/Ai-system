"use client";
import Link from "next/link";
import useSWR from "swr";
import { fetcher } from "@/lib/client";
import { PageHeader, Card, StatusBadge, EmptyState, Spinner } from "@/components/ui";
import { formatDuration, formatDateTime } from "@/lib/utils";

function LiveDuration({ start }: { start?: string | null }) {
  if (!start) return <span>—</span>;
  const secs = Math.max(0, Math.floor((Date.now() - new Date(start).getTime()) / 1000));
  return <span className="font-mono">{formatDuration(secs)}</span>;
}

export default function ActiveCallsPage() {
  const { data, isLoading } = useSWR("/api/calls/active", fetcher, {
    refreshInterval: 3000,
  });
  const active = data?.active || [];
  const recent = data?.recent || [];

  return (
    <div>
      <PageHeader
        title="Active Calls"
        subtitle="Real-time calling status (auto-refreshing)"
      />

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner className="text-brand-600" />
        </div>
      ) : (
        <div className="space-y-6">
          <Card>
            <div className="mb-4 flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
              </span>
              <h3 className="font-semibold">Calling Now ({active.length})</h3>
            </div>
            {active.length === 0 ? (
              <EmptyState
                icon="📡"
                title="No active calls"
                description="Start a campaign or place a call to see live status here."
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {active.map((c: any) => (
                  <Link key={c.id} href={`/clients/${c.clientId}`}>
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 transition hover:shadow">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-slate-800">
                          {c.client.firstName} {c.client.lastName}
                        </p>
                        <StatusBadge status={c.status} />
                      </div>
                      <p className="font-mono text-xs text-slate-500">{c.phoneNumber}</p>
                      <div className="mt-2 flex items-center justify-between text-sm">
                        <span className="text-slate-400">Duration</span>
                        <LiveDuration start={c.startTime} />
                      </div>
                      {c.campaign?.name && (
                        <p className="mt-1 text-xs text-slate-400">📣 {c.campaign.name}</p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-0">
            <div className="border-b border-[var(--border)] p-4">
              <h3 className="font-semibold">Recently Completed</h3>
            </div>
            {recent.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">No completed calls yet.</p>
            ) : (
              <div className="table-wrap">
                <table className="w-full">
                  <thead className="border-b border-[var(--border)]">
                    <tr>
                      <th className="th">Client</th>
                      <th className="th">Phone</th>
                      <th className="th">Status</th>
                      <th className="th">Duration</th>
                      <th className="th">Completed</th>
                      <th className="th">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {recent.map((c: any) => (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="td font-medium">
                          {c.client.firstName} {c.client.lastName}
                        </td>
                        <td className="td font-mono text-xs">{c.phoneNumber}</td>
                        <td className="td"><StatusBadge status={c.status} /></td>
                        <td className="td">{formatDuration(c.duration)}</td>
                        <td className="td text-xs">{formatDateTime(c.updatedAt)}</td>
                        <td className="td">
                          <Link href={`/clients/${c.clientId}`} className="btn-ghost px-2 py-1 text-xs">
                            View report
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
