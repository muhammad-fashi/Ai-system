"use client";
import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { fetcher } from "@/lib/client";
import {
  PageHeader,
  Card,
  StatusBadge,
  InterestBadge,
  Pagination,
  EmptyState,
  Spinner,
} from "@/components/ui";
import { formatDateTime, formatDuration, titleCase } from "@/lib/utils";

const CALL_STATUSES = ["COMPLETED", "FAILED", "NO_ANSWER", "BUSY", "VOICEMAIL", "CONNECTED", "INITIATED"];
const OUTCOMES = [
  "INTERESTED", "NOT_INTERESTED", "FOLLOW_UP_REQUIRED", "MEETING_REQUESTED",
  "PRICING_REQUESTED", "INFORMATION_REQUESTED", "NO_ANSWER", "DO_NOT_CALL",
];

export default function HistoryPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [outcome, setOutcome] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const params = new URLSearchParams({ page: String(page), q, status, outcome, from, to });
  const { data, isLoading } = useSWR(`/api/calls?${params}`, fetcher);
  const calls = data?.calls || [];

  return (
    <div>
      <PageHeader title="Call History" subtitle="Every outbound call across all campaigns" />

      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <input
            className="input max-w-xs"
            placeholder="Search client, phone, call ID…"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
          />
          <select className="input max-w-[160px]" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            {CALL_STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
          </select>
          <select className="input max-w-[180px]" value={outcome} onChange={(e) => { setOutcome(e.target.value); setPage(1); }}>
            <option value="">All outcomes</option>
            {OUTCOMES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
          </select>
          <div>
            <label className="label">From</label>
            <input type="date" className="input" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
          </div>
          <div>
            <label className="label">To</label>
            <input type="date" className="input" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
          </div>
        </div>
      </Card>

      <Card className="p-0">
        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner className="text-brand-600" /></div>
        ) : calls.length === 0 ? (
          <EmptyState icon="🕑" title="No calls found" description="Adjust filters or start a campaign." />
        ) : (
          <div className="table-wrap">
            <table className="w-full">
              <thead className="border-b border-[var(--border)]">
                <tr>
                  <th className="th">Date</th>
                  <th className="th">Client</th>
                  <th className="th">Phone</th>
                  <th className="th">Duration</th>
                  <th className="th">Status</th>
                  <th className="th">Interest</th>
                  <th className="th">Outcome</th>
                  <th className="th">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {calls.map((c: any) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="td text-xs">{formatDateTime(c.createdAt)}</td>
                    <td className="td font-medium">
                      {c.client.firstName} {c.client.lastName}
                      {c.isTest && <span className="ml-1 badge bg-violet-100 text-violet-700">TEST</span>}
                    </td>
                    <td className="td font-mono text-xs">{c.phoneNumber}</td>
                    <td className="td">{formatDuration(c.duration)}</td>
                    <td className="td"><StatusBadge status={c.status} /></td>
                    <td className="td"><InterestBadge level={c.interestLevel} /></td>
                    <td className="td"><StatusBadge status={c.outcome} /></td>
                    <td className="td">
                      <Link href={`/clients/${c.clientId}`} className="btn-ghost px-2 py-1 text-xs">
                        Report
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data?.pagination && (
              <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onChange={setPage} />
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
