"use client";
import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { api, fetcher } from "@/lib/client";
import {
  PageHeader,
  Card,
  StatusBadge,
  InterestBadge,
  EmptyState,
  Spinner,
  Modal,
} from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";

export default function ReportsPage() {
  const { toast } = useToast();
  const { data, isLoading } = useSWR(
    "/api/clients?sortBy=lastCallAt&sortDir=desc&pageSize=50",
    fetcher
  );
  const called = (data?.clients || []).filter((c: any) => c.callCount > 0);

  const [testOpen, setTestOpen] = useState(false);
  const [test, setTest] = useState({ name: "", phone: "" });
  const [placing, setPlacing] = useState(false);

  async function placeTest() {
    setPlacing(true);
    try {
      const r = await api<{ mock: boolean }>("/api/calls/start", {
        method: "POST",
        body: JSON.stringify({ test: true, ...test }),
      });
      toast(r.mock ? "Mock test call placed" : "Test call initiated", "success");
      setTestOpen(false);
      setTest({ name: "", phone: "" });
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setPlacing(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Call Reports"
        subtitle="Open a client to view their full report, transcript & recording"
        actions={
          <button className="btn-secondary" onClick={() => setTestOpen(true)}>
            🧪 Test Call
          </button>
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner className="text-brand-600" /></div>
      ) : called.length === 0 ? (
        <Card>
          <EmptyState
            icon="📄"
            title="No call reports yet"
            description="Once clients have been called, their reports appear here."
            action={<Link href="/start-calling" className="btn-primary">🚀 Start Calling</Link>}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {called.map((c: any) => (
            <Link key={c.id} href={`/clients/${c.id}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      {c.firstName} {c.lastName}
                    </h3>
                    {c.companyName && <p className="text-sm text-slate-500">{c.companyName}</p>}
                  </div>
                  <InterestBadge level={c.interestLevel} />
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <StatusBadge status={c.status} />
                  {c.leadScore != null && (
                    <span className="text-sm font-semibold text-brand-700">{c.leadScore}/100</span>
                  )}
                </div>
                <div className="mt-3 flex justify-between text-xs text-slate-400">
                  <span>{c.callCount} call{c.callCount !== 1 ? "s" : ""}</span>
                  <span>Last: {formatDate(c.lastCallAt)}</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Modal
        open={testOpen}
        onClose={() => setTestOpen(false)}
        title="Place a test call"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setTestOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={placeTest} disabled={placing || !test.phone}>
              {placing ? <Spinner /> : "Place Test Call"}
            </button>
          </>
        }
      >
        <p className="mb-3 text-sm text-slate-500">
          Test the AI agent before running a real campaign. Test calls are clearly
          labelled <span className="badge bg-violet-100 text-violet-700">TEST</span> in history.
        </p>
        <div className="space-y-3">
          <div>
            <label className="label">Name</label>
            <input className="input" value={test.name} onChange={(e) => setTest({ ...test, name: e.target.value })} placeholder="John" />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" value={test.phone} onChange={(e) => setTest({ ...test, phone: e.target.value })} placeholder="+15551234567" />
          </div>
        </div>
      </Modal>
    </div>
  );
}
