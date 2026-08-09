"use client";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { api, fetcher } from "@/lib/client";
import { PageHeader, Card, Spinner } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";

const TONES = ["Professional", "Friendly", "Consultative", "Concise"];

const FIELDS: { key: string; label: string; textarea?: boolean; hint?: string }[] = [
  { key: "agentName", label: "Agent Name" },
  { key: "companyName", label: "Company Name" },
  { key: "companyDescription", label: "Company Description", textarea: true },
  { key: "websiteServices", label: "Website Services", textarea: true },
  { key: "seoServices", label: "SEO Services", textarea: true, hint: "Never guarantee rankings." },
  { key: "socialServices", label: "Social Media Services", textarea: true },
  { key: "pricingInfo", label: "Pricing Information", textarea: true },
  { key: "faqs", label: "FAQs", textarea: true },
  { key: "salesRules", label: "Sales Rules", textarea: true },
  { key: "qualificationQuestions", label: "Qualification Questions", textarea: true },
  { key: "objectionHandling", label: "Objection Handling", textarea: true },
];

export default function AiAgentPage() {
  const { toast } = useToast();
  const { data, mutate } = useSWR("/api/settings", fetcher);
  const { data: promptData } = useSWR("/api/ai-agent/prompt", fetcher);
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data?.settings?.aiAgent && !form) setForm(data.settings.aiAgent);
  }, [data, form]);

  async function save() {
    setSaving(true);
    try {
      await api("/api/settings", {
        method: "PUT",
        body: JSON.stringify({ key: "aiAgent", value: form }),
      });
      toast("AI agent configuration saved", "success");
      mutate();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  if (!form)
    return <div className="flex justify-center py-20"><Spinner className="text-brand-600" /></div>;

  return (
    <div>
      <PageHeader
        title="AI Agent"
        subtitle="Configure your AI sales representative's knowledge and behavior"
        actions={<button className="btn-primary" onClick={save} disabled={saving}>{saving ? <Spinner /> : "Save Configuration"}</button>}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="space-y-4">
          <Card>
            <div className="mb-4">
              <label className="label">Tone</label>
              <div className="flex flex-wrap gap-2">
                {TONES.map((t) => (
                  <button
                    key={t}
                    onClick={() => setForm({ ...form, tone: t })}
                    className={`badge cursor-pointer border ${
                      form.tone === t ? "border-brand-500 bg-brand-50 text-brand-700" : "border-[var(--border)] bg-white text-slate-600"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            {FIELDS.map((f) => (
              <div key={f.key} className="mb-3">
                <label className="label">{f.label}</label>
                {f.textarea ? (
                  <textarea
                    className="input min-h-[90px]"
                    value={form[f.key] || ""}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  />
                ) : (
                  <input
                    className="input"
                    value={form[f.key] || ""}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  />
                )}
                {f.hint && <p className="mt-1 text-xs text-amber-600">{f.hint}</p>}
              </div>
            ))}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-semibold">Generated Retell Agent Prompt</h3>
              <button
                className="btn-secondary py-1.5"
                onClick={() => {
                  navigator.clipboard.writeText(promptData?.prompt || "");
                  toast("Prompt copied", "success");
                }}
              >
                📋 Copy
              </button>
            </div>
            <p className="mb-3 text-xs text-slate-500">
              Paste this into your Retell agent's system prompt. It uses{" "}
              <code>{"{{dynamic_variable}}"}</code> placeholders that the backend fills
              per client on each call.
            </p>
            <pre className="max-h-[420px] overflow-auto rounded-lg bg-slate-900 p-4 text-xs leading-relaxed text-slate-100 whitespace-pre-wrap">
              {promptData?.prompt || "Loading…"}
            </pre>
          </Card>

          <Card>
            <h3 className="mb-2 font-semibold">Dynamic Variables</h3>
            <p className="mb-3 text-xs text-slate-500">
              These are sent to Retell on every call and can be referenced in your agent.
            </p>
            <div className="flex flex-wrap gap-2">
              {(promptData?.dynamicVariables || []).map((v: string) => (
                <code key={v} className="badge bg-slate-100 text-slate-700">{`{{${v}}}`}</code>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
