"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { api, fetcher } from "@/lib/client";
import {
  PageHeader,
  Card,
  Modal,
  StatusBadge,
  Spinner,
  EmptyState,
} from "@/components/ui";
import { CLIENT_STATUSES } from "@/lib/validation";
import { titleCase } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";

export default function StartCallingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState(
    `Outreach ${new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" })}`
  );
  const [statusFilter, setStatusFilter] = useState("NEW");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState(false);
  const [starting, setStarting] = useState(false);
  const [maxConcurrency, setMaxConcurrency] = useState(2);

  const { data } = useSWR(
    `/api/clients?pageSize=100&status=${statusFilter}`,
    fetcher
  );
  const { data: settings } = useSWR("/api/settings", fetcher);
  const clients = (data?.clients || []).filter((c: any) => !c.doNotCall);

  function toggle(id: string) {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  }
  function selectAll() {
    if (selected.size === clients.length) setSelected(new Set());
    else setSelected(new Set(clients.map((c: any) => c.id)));
  }

  async function launch() {
    setStarting(true);
    try {
      // 1. Create the campaign with the selected clients.
      const { campaign } = await api<{ campaign: any }>("/api/campaigns", {
        method: "POST",
        body: JSON.stringify({
          name,
          clientIds: [...selected],
          maxConcurrency,
        }),
      });
      // 2. Start it.
      await api(`/api/campaigns/${campaign.id}/start`, { method: "POST" });
      toast("Campaign started — calls are being placed", "success");
      router.push(`/campaigns/${campaign.id}`);
    } catch (e) {
      toast((e as Error).message, "error");
      setStarting(false);
      setConfirm(false);
    }
  }

  const fromNumber =
    settings?.retellStatus?.fromNumber ||
    settings?.settings?.retell?.fromNumber ||
    "Not configured";
  const isMock = settings?.retellStatus?.mock;

  return (
    <div>
      <PageHeader
        title="Start Calling"
        subtitle="Create a campaign and launch AI outbound calls"
      />

      {isMock && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          ⚠️ Retell API key is not configured — the system is in <strong>MOCK mode</strong>.
          Calls will be simulated (with generated transcripts) so you can test the full flow.
          Add <code>RETELL_API_KEY</code> in Settings to place real calls.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <label className="label">Campaign Name</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="August Website Outreach"
            />
          </Card>

          <Card className="p-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] p-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Select clients by status:</span>
                <select
                  className="input max-w-[180px] py-1.5"
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setSelected(new Set());
                  }}
                >
                  {CLIENT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {titleCase(s)}
                    </option>
                  ))}
                </select>
              </div>
              <button className="btn-secondary py-1.5" onClick={selectAll}>
                {selected.size === clients.length && clients.length > 0
                  ? "Deselect all"
                  : "Select all"}
              </button>
            </div>

            {clients.length === 0 ? (
              <EmptyState
                icon="👥"
                title="No eligible clients"
                description="No callable clients with this status. Import clients or change the filter."
              />
            ) : (
              <div className="max-h-[400px] overflow-y-auto">
                {clients.map((c: any) => (
                  <label
                    key={c.id}
                    className="flex cursor-pointer items-center gap-3 border-b border-slate-50 px-4 py-2.5 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(c.id)}
                      onChange={() => toggle(c.id)}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {c.firstName} {c.lastName}{" "}
                        {c.companyName && (
                          <span className="text-slate-400">· {c.companyName}</span>
                        )}
                      </p>
                      <p className="font-mono text-xs text-slate-400">{c.phone}</p>
                    </div>
                    <StatusBadge status={c.status} />
                  </label>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <h3 className="mb-3 font-semibold">Campaign Summary</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-400">Selected clients</dt>
                <dd className="text-xl font-bold text-brand-700">{selected.size}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">From number</dt>
                <dd className="font-mono text-xs">{fromNumber}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Agent</dt>
                <dd>{settings?.settings?.aiAgent?.agentName || "AI Agent"}</dd>
              </div>
              <div>
                <dt className="mb-1 text-slate-400">Max concurrent calls</dt>
                <input
                  type="number"
                  min={1}
                  max={20}
                  className="input py-1.5"
                  value={maxConcurrency}
                  onChange={(e) => setMaxConcurrency(Number(e.target.value))}
                />
              </div>
            </dl>
            <button
              className="btn-primary mt-4 w-full py-3 text-base"
              disabled={selected.size === 0 || !name}
              onClick={() => setConfirm(true)}
            >
              🚀 START AI CALLING
            </button>
          </Card>

          <Card>
            <h4 className="mb-2 text-sm font-semibold">How it works</h4>
            <ol className="list-inside list-decimal space-y-1 text-xs text-slate-500">
              <li>A campaign is created with your selected clients.</li>
              <li>The backend queue places calls respecting concurrency & calling hours.</li>
              <li>Calls continue even if you close the browser (server-side cron).</li>
              <li>Transcripts, summaries & lead scores are saved automatically.</li>
            </ol>
          </Card>
        </div>
      </div>

      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Confirm campaign launch"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setConfirm(false)} disabled={starting}>
              Cancel
            </button>
            <button className="btn-primary" onClick={launch} disabled={starting}>
              {starting ? <Spinner /> : "Start Campaign"}
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          You are about to start calls to{" "}
          <strong>{selected.size} client{selected.size !== 1 ? "s" : ""}</strong>.
        </p>
        <ul className="mt-3 space-y-1 text-sm text-slate-500">
          <li>• Campaign: <strong>{name}</strong></li>
          <li>• From number: <span className="font-mono">{fromNumber}</span></li>
          <li>• Max concurrent calls: {maxConcurrency}</li>
          <li>• Clients on the Do Not Call list are automatically excluded.</li>
        </ul>
      </Modal>
    </div>
  );
}
