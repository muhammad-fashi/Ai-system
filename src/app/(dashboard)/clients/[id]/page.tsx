"use client";
import { use, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { api, fetcher } from "@/lib/client";
import {
  PageHeader,
  Card,
  StatusBadge,
  InterestBadge,
  Spinner,
  EmptyState,
} from "@/components/ui";
import TranscriptView from "@/components/TranscriptView";
import { formatDateTime, formatDuration, formatDate, titleCase } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";

export default function ClientReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { toast } = useToast();
  const { data, isLoading, mutate } = useSWR(`/api/clients/${id}/report`, fetcher);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);

  if (isLoading || !data)
    return (
      <div className="flex justify-center py-20">
        <Spinner className="text-brand-600" />
      </div>
    );

  const { client, stats, latestCall, calls } = data;
  const selectedCall = selectedCallId
    ? calls.find((c: any) => c.id === selectedCallId)
    : latestCall;

  async function callNow() {
    try {
      const r = await api<{ mock: boolean }>(`/api/clients/${id}/call`, {
        method: "POST",
      });
      toast(r.mock ? "Mock call placed (simulated)" : "Call initiated", "success");
      setTimeout(() => mutate(), 800);
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  async function refreshFromRetell(callId: string) {
    try {
      const r = await api<{ updated: boolean; status?: string }>(
        `/api/calls/${callId}/sync`,
        { method: "POST" }
      );
      if (r.updated) {
        toast("Call updated from Retell", "success");
      } else {
        toast(
          r.status === "ongoing" || r.status === "registered"
            ? "Call still in progress — try again shortly"
            : "No new data from Retell yet",
          "info"
        );
      }
      mutate();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  return (
    <div>
      <PageHeader
        title={`${client.firstName} ${client.lastName || ""}`}
        subtitle={client.companyName || "Client report"}
        actions={
          <>
            <Link href="/clients" className="btn-secondary">
              ← Back
            </Link>
            <button className="btn-primary" onClick={callNow} disabled={client.doNotCall}>
              📞 Call again
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column: client info + overview */}
        <div className="space-y-6">
          <Card>
            <h3 className="mb-3 font-semibold">Client Information</h3>
            <dl className="space-y-2 text-sm">
              <Row label="Name" value={`${client.firstName} ${client.lastName || ""}`} />
              <Row label="Company" value={client.companyName} />
              <Row label="Phone" value={<span className="font-mono">{client.phone}</span>} />
              <Row label="Email" value={client.email} />
              <Row
                label="Website"
                value={
                  client.website ? (
                    <a
                      href={client.website.startsWith("http") ? client.website : `https://${client.website}`}
                      target="_blank"
                      className="text-brand-600 hover:underline"
                      rel="noreferrer"
                    >
                      {client.website}
                    </a>
                  ) : null
                }
              />
              <Row label="Industry" value={client.industry} />
              <Row label="Location" value={[client.city, client.country].filter(Boolean).join(", ")} />
              <Row label="Status" value={<StatusBadge status={client.status} />} />
              <Row label="Interest" value={<InterestBadge level={client.interestLevel} />} />
              {client.doNotCall && (
                <div className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                  🚫 This client is on the Do Not Call list
                </div>
              )}
            </dl>
          </Card>

          <Card>
            <h3 className="mb-3 font-semibold">Call Overview</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Metric label="Total calls" value={stats.totalCalls} />
              <Metric label="Successful" value={stats.successful} />
              <Metric label="Failed" value={stats.failed} />
              <Metric label="Talk time" value={formatDuration(stats.totalDuration)} />
              <Metric label="Last call" value={formatDate(stats.lastCallAt)} />
              <Metric label="Lead score" value={client.leadScore ?? "—"} />
            </div>
          </Card>

          {client.servicesNeeded?.length > 0 && (
            <Card>
              <h3 className="mb-3 font-semibold">Services of Interest</h3>
              <div className="flex flex-wrap gap-2">
                {client.servicesNeeded.map((s: string) => (
                  <span key={s} className="badge bg-brand-50 text-brand-700">
                    {s}
                  </span>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Right columns: latest call + transcript */}
        <div className="space-y-6 lg:col-span-2">
          {!selectedCall ? (
            <Card>
              <EmptyState
                icon="📞"
                title="No calls yet"
                description="Place a call to generate a report, transcript, and AI summary."
                action={
                  <button className="btn-primary" onClick={callNow} disabled={client.doNotCall}>
                    📞 Call now
                  </button>
                }
              />
            </Card>
          ) : (
            <>
              <Card>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold">Call Report</h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      className="btn-secondary py-1.5"
                      onClick={() => refreshFromRetell(selectedCall.id)}
                      title="Pull the latest transcript & result from Retell"
                    >
                      🔄 Refresh from Retell
                    </button>
                    {calls.length > 1 && (
                      <select
                        className="input max-w-[220px] py-1.5"
                        value={selectedCall.id}
                        onChange={(e) => setSelectedCallId(e.target.value)}
                      >
                        {calls.map((c: any) => (
                          <option key={c.id} value={c.id}>
                            {formatDateTime(c.createdAt)} · {titleCase(c.status)}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                  <Metric label="Date" value={formatDate(selectedCall.startTime || selectedCall.createdAt)} />
                  <Metric label="Duration" value={formatDuration(selectedCall.duration)} />
                  <Metric label="Status" value={<StatusBadge status={selectedCall.status} />} />
                  <Metric label="Outcome" value={<StatusBadge status={selectedCall.outcome} />} />
                  <Metric label="Interest" value={<InterestBadge level={selectedCall.interestLevel} />} />
                  <Metric label="Sentiment" value={selectedCall.sentiment || "—"} />
                </div>

                {selectedCall.leadScore != null && (
                  <div className="mt-4 rounded-lg bg-slate-50 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-700">Lead Score</span>
                      <span className="text-lg font-bold text-brand-700">
                        {selectedCall.leadScore}/100
                      </span>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-brand-600"
                        style={{ width: `${selectedCall.leadScore}%` }}
                      />
                    </div>
                    {selectedCall.leadScoreReason && (
                      <p className="mt-2 text-xs text-slate-500">{selectedCall.leadScoreReason}</p>
                    )}
                  </div>
                )}

                {selectedCall.summary && (
                  <div className="mt-4">
                    <h4 className="mb-1 text-sm font-semibold text-slate-700">AI Summary</h4>
                    <p className="rounded-lg bg-brand-50/60 p-3 text-sm text-slate-700">
                      {selectedCall.summary}
                    </p>
                  </div>
                )}

                {selectedCall.servicesDiscussed?.length > 0 && (
                  <div className="mt-4">
                    <h4 className="mb-1 text-sm font-semibold text-slate-700">Services Discussed</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedCall.servicesDiscussed.map((s: string) => (
                        <span key={s} className="badge bg-violet-50 text-violet-700">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {selectedCall.nextAction && (
                  <div className="mt-4 text-sm">
                    <span className="font-semibold text-slate-700">Next action: </span>
                    <span className="text-slate-600">{selectedCall.nextAction}</span>
                  </div>
                )}

                {selectedCall.recordingUrl && (
                  <div className="mt-4">
                    <h4 className="mb-1 text-sm font-semibold text-slate-700">Recording</h4>
                    <audio controls className="w-full">
                      <source src={selectedCall.recordingUrl} />
                    </audio>
                  </div>
                )}
              </Card>

              <Card>
                <h3 className="mb-3 font-semibold">Call Transcript</h3>
                <TranscriptView
                  transcript={selectedCall.transcript}
                  transcriptText={selectedCall.transcriptText}
                />
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-50 py-1 last:border-0">
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-right font-medium text-slate-700">{value || "—"}</dd>
    </div>
  );
}
function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-0.5 font-semibold text-slate-800">{value}</p>
    </div>
  );
}
