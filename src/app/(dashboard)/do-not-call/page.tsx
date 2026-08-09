"use client";
import { useState } from "react";
import useSWR from "swr";
import { api, fetcher } from "@/lib/client";
import { PageHeader, Card, EmptyState, Spinner, ConfirmDialog } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";

export default function DoNotCallPage() {
  const { toast } = useToast();
  const { data, isLoading, mutate } = useSWR("/api/do-not-call", fetcher);
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("");
  const [adding, setAdding] = useState(false);
  const [removePhone, setRemovePhone] = useState<string | null>(null);
  const entries = data?.entries || [];

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    try {
      await api("/api/do-not-call", { method: "POST", body: JSON.stringify({ phone, reason }) });
      toast("Added to Do Not Call list", "success");
      setPhone("");
      setReason("");
      mutate();
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setAdding(false);
    }
  }
  async function remove() {
    if (!removePhone) return;
    try {
      await api("/api/do-not-call", { method: "DELETE", body: JSON.stringify({ phone: removePhone }) });
      toast("Removed from Do Not Call list", "success");
      setRemovePhone(null);
      mutate();
    } catch (err) {
      toast((err as Error).message, "error");
    }
  }

  return (
    <div>
      <PageHeader
        title="Do Not Call List"
        subtitle="Numbers excluded from all automated outbound calls"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <h3 className="mb-3 font-semibold">Add a number</h3>
          <form onSubmit={add} className="space-y-3">
            <div>
              <label className="label">Phone number</label>
              <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+15551234567" required />
            </div>
            <div>
              <label className="label">Reason</label>
              <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Customer request" />
            </div>
            <button className="btn-danger w-full" disabled={adding}>
              {adding ? <Spinner /> : "🚫 Add to Do Not Call"}
            </button>
          </form>
        </Card>

        <Card className="p-0 lg:col-span-2">
          {isLoading ? (
            <div className="flex justify-center py-16"><Spinner className="text-brand-600" /></div>
          ) : entries.length === 0 ? (
            <EmptyState icon="🚫" title="List is empty" description="Numbers added here will never be called automatically." />
          ) : (
            <div className="table-wrap">
              <table className="w-full">
                <thead className="border-b border-[var(--border)]">
                  <tr>
                    <th className="th">Phone</th>
                    <th className="th">Client</th>
                    <th className="th">Reason</th>
                    <th className="th">Added</th>
                    <th className="th">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {entries.map((e: any) => (
                    <tr key={e.id} className="hover:bg-slate-50">
                      <td className="td font-mono text-xs">{e.phone}</td>
                      <td className="td">
                        {e.client ? `${e.client.firstName} ${e.client.lastName || ""}` : "—"}
                      </td>
                      <td className="td">{e.reason || "—"}</td>
                      <td className="td text-xs">{formatDate(e.createdAt)}</td>
                      <td className="td">
                        <button className="btn-ghost px-2 py-1 text-xs text-brand-600" onClick={() => setRemovePhone(e.phone)}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={!!removePhone}
        title="Remove from Do Not Call"
        message="This number will become eligible for automated calls again. Continue?"
        confirmLabel="Remove"
        onConfirm={remove}
        onCancel={() => setRemovePhone(null)}
      />
    </div>
  );
}
