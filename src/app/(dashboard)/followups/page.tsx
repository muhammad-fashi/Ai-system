"use client";
import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { api, fetcher } from "@/lib/client";
import { PageHeader, Card, StatusBadge, EmptyState, Spinner } from "@/components/ui";
import { formatDateTime, titleCase } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";

const STATUSES = ["PENDING", "COMPLETED", "RESCHEDULED", "CANCELLED"];

export default function FollowUpsPage() {
  const { toast } = useToast();
  const [status, setStatus] = useState("PENDING");
  const { data, isLoading, mutate } = useSWR(
    `/api/followups?status=${status}`,
    fetcher
  );
  const followUps = data?.followUps || [];

  async function update(id: string, changes: any) {
    try {
      await api(`/api/followups/${id}`, { method: "PUT", body: JSON.stringify(changes) });
      toast("Follow-up updated", "success");
      mutate();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }
  async function callNow(clientId: string) {
    try {
      await api(`/api/clients/${clientId}/call`, { method: "POST" });
      toast("Call placed", "success");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  return (
    <div>
      <PageHeader
        title="Follow-ups"
        subtitle="Scheduled follow-ups and callbacks"
        actions={
          <select className="input max-w-[180px]" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
          </select>
        }
      />

      <Card className="p-0">
        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner className="text-brand-600" /></div>
        ) : followUps.length === 0 ? (
          <EmptyState icon="🔔" title="No follow-ups" description="Follow-ups are created automatically after qualifying calls." />
        ) : (
          <div className="table-wrap">
            <table className="w-full">
              <thead className="border-b border-[var(--border)]">
                <tr>
                  <th className="th">Client</th>
                  <th className="th">Scheduled</th>
                  <th className="th">Reason</th>
                  <th className="th">Auto-call</th>
                  <th className="th">Status</th>
                  <th className="th">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {followUps.map((f: any) => (
                  <tr key={f.id} className="hover:bg-slate-50">
                    <td className="td font-medium">
                      <Link href={`/clients/${f.clientId}`} className="text-brand-700 hover:underline">
                        {f.client.firstName} {f.client.lastName}
                      </Link>
                      {f.client.companyName && <div className="text-xs text-slate-400">{f.client.companyName}</div>}
                    </td>
                    <td className="td text-xs">{formatDateTime(f.scheduledAt)}</td>
                    <td className="td max-w-xs truncate">{f.reason || "—"}</td>
                    <td className="td">{f.autoCall ? "✅" : "—"}</td>
                    <td className="td"><StatusBadge status={f.status} /></td>
                    <td className="td">
                      <div className="flex gap-1">
                        <button className="btn-ghost px-2 py-1 text-xs" onClick={() => callNow(f.clientId)} title="Call now">📞</button>
                        {f.status === "PENDING" && (
                          <>
                            <button className="btn-ghost px-2 py-1 text-xs text-emerald-600" onClick={() => update(f.id, { status: "COMPLETED" })}>✓ Done</button>
                            <button className="btn-ghost px-2 py-1 text-xs text-slate-500" onClick={() => update(f.id, { status: "CANCELLED" })}>✕ Cancel</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
