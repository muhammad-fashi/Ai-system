"use client";
import { useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { api } from "@/lib/client";
import { PageHeader, Card, Spinner } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { normalizePhone, isValidPhone } from "@/lib/utils";

const TARGET_FIELDS = [
  { key: "firstName", label: "First Name", required: true },
  { key: "lastName", label: "Last Name" },
  { key: "companyName", label: "Company" },
  { key: "phone", label: "Phone", required: true },
  { key: "email", label: "Email" },
  { key: "website", label: "Website" },
  { key: "industry", label: "Industry" },
  { key: "city", label: "City" },
  { key: "country", label: "Country" },
  { key: "leadSource", label: "Lead Source" },
  { key: "servicesNeeded", label: "Services" },
  { key: "notes", label: "Notes" },
];

// Guess mapping from a source header name.
function guessField(header: string): string {
  const h = header.toLowerCase().replace(/[^a-z]/g, "");
  const map: Record<string, string> = {
    firstname: "firstName",
    fname: "firstName",
    name: "firstName",
    fullname: "firstName",
    lastname: "lastName",
    lname: "lastName",
    company: "companyName",
    companyname: "companyName",
    business: "companyName",
    phone: "phone",
    phonenumber: "phone",
    mobile: "phone",
    mobilenumber: "phone",
    tel: "phone",
    email: "email",
    emailaddress: "email",
    website: "website",
    url: "website",
    site: "website",
    industry: "industry",
    niche: "industry",
    city: "city",
    country: "country",
    location: "city",
    leadsource: "leadSource",
    source: "leadSource",
    service: "servicesNeeded",
    services: "servicesNeeded",
    notes: "notes",
  };
  return map[h] || "";
}

export default function ImportPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<"skip" | "update">("skip");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<any>(null);

  function handleFile(file: File) {
    setResult(null);
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "csv") {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => {
          const data = res.data as Record<string, any>[];
          setupData(data);
        },
        error: () => toast("Failed to parse CSV", "error"),
      });
    } else if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target?.result, { type: "array" });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const data = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);
          setupData(data);
        } catch {
          toast("Failed to parse spreadsheet", "error");
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      toast("Please upload a CSV or XLSX file", "error");
    }
  }

  function setupData(data: Record<string, any>[]) {
    if (!data.length) {
      toast("File has no rows", "error");
      return;
    }
    const hdrs = Object.keys(data[0]);
    const auto: Record<string, string> = {};
    hdrs.forEach((h) => {
      auto[h] = guessField(h);
    });
    setHeaders(hdrs);
    setMapping(auto);
    setRows(data);
  }

  // Normalized preview rows using current mapping.
  const mapped = rows.map((r) => {
    const out: Record<string, any> = {};
    for (const [src, target] of Object.entries(mapping)) {
      if (target) out[target] = r[src];
    }
    return out;
  });

  const valid = mapped.filter(
    (m) => m.firstName && m.phone && isValidPhone(normalizePhone(String(m.phone)))
  );
  const invalid = mapped.length - valid.length;
  // Duplicate phones within the file.
  const seen = new Set<string>();
  let dupes = 0;
  for (const m of valid) {
    const p = normalizePhone(String(m.phone));
    if (seen.has(p)) dupes++;
    else seen.add(p);
  }

  const hasRequiredMapping =
    Object.values(mapping).includes("firstName") &&
    Object.values(mapping).includes("phone");

  async function runImport() {
    setImporting(true);
    try {
      const res = await api("/api/clients/import", {
        method: "POST",
        body: JSON.stringify({ rows: mapped, mode }),
      });
      setResult(res);
      toast("Import complete", "success");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setImporting(false);
    }
  }

  function reset() {
    setRows([]);
    setHeaders([]);
    setMapping({});
    setResult(null);
  }

  return (
    <div>
      <PageHeader
        title="Import Clients"
        subtitle="Upload a CSV or XLSX file, map the columns, and import"
      />

      {rows.length === 0 ? (
        <Card>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-[var(--border)] py-16 text-center hover:border-brand-400">
            <span className="text-4xl">📄</span>
            <span className="font-medium text-slate-700">
              Click to upload CSV or XLSX
            </span>
            <span className="text-sm text-slate-400">
              Columns like Name, Phone, Email, Website, Industry are auto-detected
            </span>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </label>
        </Card>
      ) : result ? (
        <Card>
          <h3 className="mb-4 text-lg font-semibold">Import Complete ✅</h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <ResultTile label="Imported" value={result.imported} color="text-emerald-600" />
            <ResultTile label="Updated" value={result.updated} color="text-brand-600" />
            <ResultTile label="Skipped" value={result.skipped} color="text-amber-600" />
            <ResultTile label="Invalid" value={result.invalid} color="text-red-600" />
          </div>
          {result.errors?.length > 0 && (
            <div className="mt-4 max-h-40 overflow-y-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
              {result.errors.slice(0, 50).map((e: any, i: number) => (
                <div key={i}>Row {e.row}: {e.reason}</div>
              ))}
            </div>
          )}
          <div className="mt-4 flex gap-2">
            <button className="btn-secondary" onClick={reset}>
              Import another file
            </button>
            <a href="/clients" className="btn-primary">
              View clients
            </a>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <h3 className="mb-4 font-semibold">Column Mapping</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {headers.map((h) => (
                <div key={h}>
                  <label className="label truncate">{h}</label>
                  <select
                    className="input"
                    value={mapping[h] || ""}
                    onChange={(e) => setMapping({ ...mapping, [h]: e.target.value })}
                  >
                    <option value="">— Ignore —</option>
                    {TARGET_FIELDS.map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label}
                        {f.required ? " *" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            {!hasRequiredMapping && (
              <p className="mt-3 text-sm text-red-600">
                You must map both a <strong>First Name</strong> and a{" "}
                <strong>Phone</strong> column.
              </p>
            )}
          </Card>

          <Card>
            <h3 className="mb-3 font-semibold">Preview</h3>
            <div className="mb-3 flex flex-wrap gap-3 text-sm">
              <Badge label="Total rows" value={mapped.length} />
              <Badge label="Valid" value={valid.length} color="bg-emerald-50 text-emerald-700" />
              <Badge label="Invalid" value={invalid} color="bg-red-50 text-red-700" />
              <Badge label="Duplicates in file" value={dupes} color="bg-amber-50 text-amber-700" />
            </div>
            <div className="table-wrap max-h-72 overflow-y-auto rounded-lg border border-[var(--border)]">
              <table className="w-full">
                <thead className="sticky top-0 bg-slate-50">
                  <tr>
                    {["firstName", "lastName", "companyName", "phone", "email", "website"].map((k) => (
                      <th key={k} className="th">{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {mapped.slice(0, 20).map((m, i) => (
                    <tr key={i}>
                      <td className="td">{m.firstName || <span className="text-red-500">missing</span>}</td>
                      <td className="td">{m.lastName || "—"}</td>
                      <td className="td">{m.companyName || "—"}</td>
                      <td className="td font-mono text-xs">{m.phone || <span className="text-red-500">missing</span>}</td>
                      <td className="td">{m.email || "—"}</td>
                      <td className="td">{m.website || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={mode === "skip"}
                  onChange={() => setMode("skip")}
                />
                Skip duplicates
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={mode === "update"}
                  onChange={() => setMode("update")}
                />
                Update existing clients
              </label>
              <div className="ml-auto flex gap-2">
                <button className="btn-secondary" onClick={reset}>
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  disabled={!hasRequiredMapping || valid.length === 0 || importing}
                  onClick={runImport}
                >
                  {importing ? <Spinner /> : `Import ${valid.length} clients`}
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function ResultTile({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-4 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
function Badge({ label, value, color = "bg-slate-100 text-slate-700" }: { label: string; value: number; color?: string }) {
  return (
    <span className={`badge ${color}`}>
      {label}: <strong>{value}</strong>
    </span>
  );
}
