"use client";
import { use } from "react";
import Link from "next/link";
import useSWR from "swr";
import { api, fetcher } from "@/lib/client";
import {
  PageHeader,
  Card,
  StatusBadge,
  Spinner,
  StatCard,
} from "@/components/ui";
import { useToast } from "@/components/ui/Toast";

export default function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { toast } = useToast();
  const { data, isLoading, mutate } = useSWR(`/api/campaigns/${id}`, fetcher, {
    refreshInterval: 8000,
  });

  if (isLoading || !data)
    return (
      <div className="flex justify-center py-20">
        <Spinner className="text-brand-600" />
      </div>
    );

  const { campaign, stats } = data;

  async function control(action: string) {
    try {
      await api(`/api/campaigns/${id}/${action}`, { method: "POST" });
      toast(`Campaign ${action}ed`, "success");
      mutate();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  const running = campaign.status === "RUNNING";
  const paused = campaign.status === "PAUSED";

  return (
    <div>
      <PageHeader
        title={campaign.name}
        subtitle={campaign.description || "Campaign details"}
        actions={
          <>
            <Link href="/campaigns" className="btn-secondary">
              ← Back
            </Link>
            {(campaign.status === "DRAFT" || paused || campaign.status === "STOPPED") && (
              <button className="btn-primary" onClick={() => control("start")}>
                ▶ {paused ? "Resume" : "Start"}
              </button>
            )}
            {running && (
              <button className="btn-secondary" onClick={() => control("pause")}>
                ⏸ Pause
              </button>
            )}
            {(running || paused) && (
              <button className="btn-danger" onClick={() => control("stop")}>
                ⏹ Stop
              </button>
            )}
          </>
        }
      />

      <div className="mb-4 flex items-center gap-3">
        <StatusBadge status={campaign.status} />
        <span className="text-sm text-slate-500">
          Concurrency {campaign.maxConcurrency} · Retries {campaign.retryLimit} · Hours{" "}
          {campaign.callingHoursStart}:00–{campaign.callingHoursEnd}:00 {campaign.timezone}
        </span>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Total Leads" value={stats.totalLeads} icon="👥" />
        <StatCard label="Attempted" value={stats.attempted} icon="📞" accent="violet" />
        <StatCard label="Connected" value={stats.connected} icon="✅" accent="green" />
        <StatCard label="Interested" value={stats.interested} icon="🔥" accent="amber" />
        <StatCard label="No Answer" value={stats.noAnswer} icon="🔕" accent="slate" />
        <StatCard label="Follow-ups" value={stats.followUps} icon="🔔" accent="amber" />
        <StatCard label="Meetings" value={stats.meetings} icon="📅" accent="violet" />
        <StatCard label="Conversion" value={`${stats.conversionRate}%`} icon="📈" accent="green" />
      </div>

      <Card className="p-0">
        <div className="border-b border-[var(--border)] p-4">
          <h3 className="font-semibold">Calling Queue</h3>
        </div>
        <div className="table-wrap">
          <table className="w-full">
            <thead className="border-b border-[var(--border)]">
              <tr>
                <th className="th">#</th>
                <th className="th">Client</th>
                <th className="th">Phone</th>
                <th className="th">Queue Status</th>
                <th className="th">Attempts</th>
                <th className="th">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {campaign.campaignClients.map((cc: any, i: number) => (
                <tr key={cc.id} className="hover:bg-slate-50">
                  <td className="td">{i + 1}</td>
                  <td className="td font-medium">
                    {cc.client.firstName} {cc.client.lastName}
                    {cc.client.companyName && (
                      <span className="text-slate-400"> · {cc.client.companyName}</span>
                    )}
                  </td>
                  <td className="td font-mono text-xs">{cc.client.phone}</td>
                  <td className="td"><StatusBadge status={cc.status} /></td>
                  <td className="td">{cc.attempts}</td>
                  <td className="td">
                    <Link href={`/clients/${cc.clientId}`} className="btn-ghost px-2 py-1 text-xs">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
