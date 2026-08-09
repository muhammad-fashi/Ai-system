"use client";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { api, fetcher } from "@/lib/client";
import { PageHeader, Card, Spinner } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function SettingsPage() {
  const { toast } = useToast();
  const { data, mutate } = useSWR("/api/settings", fetcher);
  const [calling, setCalling] = useState<any>(null);
  const [notifications, setNotifications] = useState<any>(null);
  const [retell, setRetell] = useState<any>(null);
  const [saving, setSaving] = useState("");
  const [testResult, setTestResult] = useState<any>(null);

  useEffect(() => {
    if (data?.settings) {
      setCalling((c: any) => c || data.settings.calling);
      setNotifications((n: any) => n || data.settings.notifications);
      setRetell((r: any) => r || data.settings.retell);
    }
  }, [data]);

  async function saveSection(key: string, value: any) {
    setSaving(key);
    try {
      await api("/api/settings", { method: "PUT", body: JSON.stringify({ key, value }) });
      toast("Settings saved", "success");
      mutate();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving("");
    }
  }

  async function testRetell() {
    setTestResult({ loading: true });
    try {
      const r = await api("/api/settings/test-retell", { method: "POST" });
      setTestResult(r);
    } catch (e) {
      setTestResult({ ok: false, message: (e as Error).message });
    }
  }

  if (!data || !calling || !notifications || !retell)
    return <div className="flex justify-center py-20"><Spinner className="text-brand-600" /></div>;

  const rs = data.retellStatus;

  return (
    <div className="max-w-4xl">
      <PageHeader title="Settings" subtitle="Configure calling, Retell AI, and notifications" />

      {/* Retell AI */}
      <Card className="mb-6">
        <h3 className="mb-1 font-semibold">Retell AI</h3>
        <p className="mb-4 text-sm text-slate-500">
          Secret credentials (API key) are read from server environment variables only and
          are never exposed to the browser.
        </p>

        <div className="mb-4 rounded-lg border p-3 text-sm"
          style={{ borderColor: rs.configured ? "#a7f3d0" : "#fde68a", background: rs.configured ? "#ecfdf5" : "#fffbeb" }}>
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${rs.configured ? "bg-emerald-500" : "bg-amber-500"}`} />
            <span className="font-medium">
              {rs.configured ? "Retell API key configured (LIVE mode)" : "No API key — MOCK mode (calls simulated)"}
            </span>
          </div>
          <div className="mt-2 grid grid-cols-1 gap-1 text-xs text-slate-500 sm:grid-cols-2">
            <div>Phone number (env): <span className="font-mono">{rs.phoneNumber || "—"}</span></div>
            <div>From number (env): <span className="font-mono">{rs.fromNumber || "—"}</span></div>
            <div className="sm:col-span-2 break-all">Webhook URL: <span className="font-mono">{rs.webhookUrl}</span></div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="label">Agent ID (display)</label>
            <input className="input" value={retell.agentId || ""} onChange={(e) => setRetell({ ...retell, agentId: e.target.value })} />
          </div>
          <div>
            <label className="label">Phone Number</label>
            <input className="input" value={retell.phoneNumber || ""} onChange={(e) => setRetell({ ...retell, phoneNumber: e.target.value })} />
          </div>
          <div>
            <label className="label">From Number</label>
            <input className="input" value={retell.fromNumber || ""} onChange={(e) => setRetell({ ...retell, fromNumber: e.target.value })} />
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Set <code>RETELL_API_KEY</code>, <code>RETELL_AGENT_ID</code>, <code>RETELL_PHONE_NUMBER</code>,
          <code> RETELL_FROM_NUMBER</code> and <code>RETELL_WEBHOOK_SECRET</code> as environment
          variables in Vercel. These display fields default from those.
        </p>

        <div className="mt-4 flex items-center gap-3">
          <button className="btn-primary" disabled={saving === "retell"} onClick={() => saveSection("retell", retell)}>
            {saving === "retell" ? <Spinner /> : "Save"}
          </button>
          <button className="btn-secondary" onClick={testRetell}>Test connection</button>
          {testResult && !testResult.loading && (
            <span className={`text-sm ${testResult.ok ? "text-emerald-600" : "text-amber-600"}`}>
              {testResult.message}
            </span>
          )}
          {testResult?.loading && <Spinner className="text-brand-600" />}
        </div>
      </Card>

      {/* Calling */}
      <Card className="mb-6">
        <h3 className="mb-4 font-semibold">Calling</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <NumField label="Max concurrent calls" value={calling.maxConcurrency} onChange={(v) => setCalling({ ...calling, maxConcurrency: v })} />
          <NumField label="Retry attempts" value={calling.retryAttempts} onChange={(v) => setCalling({ ...calling, retryAttempts: v })} />
          <NumField label="Retry delay (min)" value={calling.retryDelayMin} onChange={(v) => setCalling({ ...calling, retryDelayMin: v })} />
          <NumField label="Delay between calls (sec)" value={calling.delayBetweenSec} onChange={(v) => setCalling({ ...calling, delayBetweenSec: v })} />
          <NumField label="Max calls per client" value={calling.maxCallsPerClient} onChange={(v) => setCalling({ ...calling, maxCallsPerClient: v })} />
          <div>
            <label className="label">Time Zone</label>
            <input className="input" value={calling.timezone} onChange={(e) => setCalling({ ...calling, timezone: e.target.value })} placeholder="UTC" />
          </div>
          <NumField label="Calling hours start (0-23)" value={calling.callingHoursStart} onChange={(v) => setCalling({ ...calling, callingHoursStart: v })} />
          <NumField label="Calling hours end (1-24)" value={calling.callingHoursEnd} onChange={(v) => setCalling({ ...calling, callingHoursEnd: v })} />
        </div>

        <div className="mt-4">
          <label className="label">Days allowed for calling</label>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((d, i) => {
              const on = calling.callingDays?.includes(i);
              return (
                <button
                  key={d}
                  onClick={() => {
                    const set = new Set(calling.callingDays || []);
                    on ? set.delete(i) : set.add(i);
                    setCalling({ ...calling, callingDays: [...set].sort() });
                  }}
                  className={`badge cursor-pointer border ${on ? "border-brand-500 bg-brand-50 text-brand-700" : "border-[var(--border)] bg-white text-slate-600"}`}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={calling.recordingEnabled} onChange={(e) => setCalling({ ...calling, recordingEnabled: e.target.checked })} />
            Recording enabled
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={calling.transcriptionEnabled} onChange={(e) => setCalling({ ...calling, transcriptionEnabled: e.target.checked })} />
            Transcription enabled
          </label>
        </div>
        <div className="mt-4">
          <label className="label">Compliance / recording disclosure message</label>
          <textarea className="input" value={calling.complianceMessage} onChange={(e) => setCalling({ ...calling, complianceMessage: e.target.value })} />
        </div>

        <button className="btn-primary mt-4" disabled={saving === "calling"} onClick={() => saveSection("calling", calling)}>
          {saving === "calling" ? <Spinner /> : "Save"}
        </button>
      </Card>

      {/* Notifications */}
      <Card className="mb-6">
        <h3 className="mb-4 font-semibold">Notifications</h3>
        <div className="space-y-3">
          {[
            ["emailNotifications", "Enable email notifications"],
            ["callCompletion", "Call completion notifications"],
            ["interestedLead", "Interested / hot lead notifications"],
            ["followUp", "Follow-up notifications"],
          ].map(([k, label]) => (
            <label key={k} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={notifications[k]} onChange={(e) => setNotifications({ ...notifications, [k]: e.target.checked })} />
              {label}
            </label>
          ))}
          <div>
            <label className="label">Notification email</label>
            <input className="input max-w-sm" value={notifications.notifyEmail} onChange={(e) => setNotifications({ ...notifications, notifyEmail: e.target.value })} placeholder="alerts@agency.com" />
          </div>
        </div>
        <button className="btn-primary mt-4" disabled={saving === "notifications"} onClick={() => saveSection("notifications", notifications)}>
          {saving === "notifications" ? <Spinner /> : "Save"}
        </button>
      </Card>
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input type="number" className="input" value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}
