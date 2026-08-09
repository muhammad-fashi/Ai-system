"use client";
import { useState } from "react";
import { AGENCY_SERVICES } from "@/lib/validation";
import { Spinner } from "@/components/ui";

export interface ClientFormValues {
  firstName?: string;
  lastName?: string;
  companyName?: string;
  phone?: string;
  email?: string;
  website?: string;
  industry?: string;
  country?: string;
  city?: string;
  timezone?: string;
  leadSource?: string;
  servicesNeeded?: string[];
  notes?: string;
  preferredLanguage?: string;
  preferredCallTime?: string;
}

export default function ClientForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel = "Save",
}: {
  initial?: ClientFormValues;
  onSubmit: (values: ClientFormValues) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
}) {
  const [v, setV] = useState<ClientFormValues>({
    servicesNeeded: [],
    ...initial,
  });
  const [loading, setLoading] = useState(false);

  function set<K extends keyof ClientFormValues>(k: K, val: ClientFormValues[K]) {
    setV((s) => ({ ...s, [k]: val }));
  }
  function toggleService(s: string) {
    const arr = new Set(v.servicesNeeded || []);
    arr.has(s) ? arr.delete(s) : arr.add(s);
    set("servicesNeeded", [...arr]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit(v);
    } finally {
      setLoading(false);
    }
  }

  const field = (
    key: keyof ClientFormValues,
    label: string,
    props: React.InputHTMLAttributes<HTMLInputElement> = {}
  ) => (
    <div>
      <label className="label">{label}</label>
      <input
        className="input"
        value={(v[key] as string) || ""}
        onChange={(e) => set(key, e.target.value as any)}
        {...props}
      />
    </div>
  );

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {field("firstName", "First Name *", { required: true })}
        {field("lastName", "Last Name")}
        {field("companyName", "Company Name")}
        {field("phone", "Phone Number *", { required: true, placeholder: "+15551234567" })}
        {field("email", "Email", { type: "email" })}
        {field("website", "Website", { placeholder: "example.com" })}
        {field("industry", "Industry")}
        {field("leadSource", "Lead Source")}
        {field("country", "Country")}
        {field("city", "City")}
        {field("timezone", "Time Zone", { placeholder: "America/New_York" })}
        {field("preferredLanguage", "Preferred Language")}
        {field("preferredCallTime", "Preferred Call Time")}
      </div>

      <div>
        <label className="label">Services Needed</label>
        <div className="flex flex-wrap gap-2">
          {AGENCY_SERVICES.map((s) => {
            const active = v.servicesNeeded?.includes(s);
            return (
              <button
                type="button"
                key={s}
                onClick={() => toggleService(s)}
                className={`badge cursor-pointer border ${
                  active
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-[var(--border)] bg-white text-slate-600"
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="label">Notes</label>
        <textarea
          className="input min-h-[80px]"
          value={v.notes || ""}
          onChange={(e) => set("notes", e.target.value)}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn-primary" disabled={loading}>
          {loading ? <Spinner /> : submitLabel}
        </button>
      </div>
    </form>
  );
}
