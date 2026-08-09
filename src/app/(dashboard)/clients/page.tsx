"use client";
import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { api, fetcher } from "@/lib/client";
import {
  PageHeader,
  Card,
  Modal,
  StatusBadge,
  InterestBadge,
  Pagination,
  EmptyState,
  Spinner,
  ConfirmDialog,
} from "@/components/ui";
import ClientForm, { ClientFormValues } from "@/components/ClientForm";
import { CLIENT_STATUSES, INTEREST_LEVELS } from "@/lib/validation";
import { formatDate, titleCase } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";

export default function ClientsPage() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [interest, setInterest] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showAdd, setShowAdd] = useState(false);
  const [editClient, setEditClient] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [bulkStatus, setBulkStatus] = useState("");

  const params = new URLSearchParams({
    page: String(page),
    q,
    status,
    interest,
    sortBy,
    sortDir,
  });
  const { data, isLoading, mutate } = useSWR(
    `/api/clients?${params.toString()}`,
    fetcher
  );

  const clients = data?.clients || [];
  const pagination = data?.pagination;

  function toggle(id: string) {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  }
  function toggleAll() {
    if (selected.size === clients.length) setSelected(new Set());
    else setSelected(new Set(clients.map((c: any) => c.id)));
  }

  async function createClient(values: ClientFormValues) {
    try {
      await api("/api/clients", { method: "POST", body: JSON.stringify(values) });
      toast("Client added", "success");
      setShowAdd(false);
      mutate();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }
  async function updateClient(values: ClientFormValues) {
    try {
      await api(`/api/clients/${editClient.id}`, {
        method: "PUT",
        body: JSON.stringify(values),
      });
      toast("Client updated", "success");
      setEditClient(null);
      mutate();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }
  async function removeClient() {
    if (!deleteId) return;
    try {
      await api(`/api/clients/${deleteId}`, { method: "DELETE" });
      toast("Client deleted", "success");
      setDeleteId(null);
      mutate();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }
  async function callClient(id: string) {
    try {
      const r = await api<{ mock: boolean }>(`/api/clients/${id}/call`, {
        method: "POST",
      });
      toast(r.mock ? "Mock call placed (simulated)" : "Call initiated", "success");
      mutate();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }
  async function bulkAction(action: string, extra: any = {}) {
    try {
      const r = await api<{ count: number }>("/api/clients/bulk", {
        method: "POST",
        body: JSON.stringify({ action, ids: [...selected], ...extra }),
      });
      toast(`Updated ${r.count} client(s)`, "success");
      setSelected(new Set());
      setBulkStatus("");
      mutate();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle="Manage your client database"
        actions={
          <>
            <Link href="/import" className="btn-secondary">
              📥 Import
            </Link>
            <button className="btn-primary" onClick={() => setShowAdd(true)}>
              + Add Client
            </button>
          </>
        }
      />

      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            className="input max-w-xs"
            placeholder="Search name, company, phone, email…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
          <select
            className="input max-w-[180px]"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {CLIENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {titleCase(s)}
              </option>
            ))}
          </select>
          <select
            className="input max-w-[160px]"
            value={interest}
            onChange={(e) => {
              setInterest(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All interest</option>
            {INTEREST_LEVELS.map((s) => (
              <option key={s} value={s}>
                {titleCase(s)}
              </option>
            ))}
          </select>
          <select
            className="input max-w-[170px]"
            value={`${sortBy}:${sortDir}`}
            onChange={(e) => {
              const [b, d] = e.target.value.split(":");
              setSortBy(b);
              setSortDir(d as any);
            }}
          >
            <option value="createdAt:desc">Newest first</option>
            <option value="createdAt:asc">Oldest first</option>
            <option value="firstName:asc">Name A–Z</option>
            <option value="leadScore:desc">Lead score</option>
            <option value="lastCallAt:desc">Recent call</option>
            <option value="callCount:desc">Most called</option>
          </select>
        </div>

        {selected.size > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-brand-50 p-3 text-sm">
            <span className="font-medium text-brand-700">
              {selected.size} selected
            </span>
            <select
              className="input max-w-[180px] py-1.5"
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value)}
            >
              <option value="">Set status…</option>
              {CLIENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {titleCase(s)}
                </option>
              ))}
            </select>
            <button
              className="btn-secondary py-1.5"
              disabled={!bulkStatus}
              onClick={() => bulkAction("status", { status: bulkStatus })}
            >
              Apply
            </button>
            <button className="btn-secondary py-1.5" onClick={() => bulkAction("doNotCall")}>
              🚫 Do Not Call
            </button>
            <button className="btn-danger py-1.5" onClick={() => bulkAction("delete")}>
              Delete
            </button>
          </div>
        )}
      </Card>

      <Card className="p-0">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner className="text-brand-600" />
          </div>
        ) : clients.length === 0 ? (
          <EmptyState
            icon="👥"
            title="No clients yet"
            description="Add clients manually or import a CSV/XLSX file to get started."
            action={
              <button className="btn-primary" onClick={() => setShowAdd(true)}>
                + Add Client
              </button>
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="w-full">
              <thead className="border-b border-[var(--border)]">
                <tr>
                  <th className="th w-10">
                    <input
                      type="checkbox"
                      checked={selected.size === clients.length && clients.length > 0}
                      onChange={toggleAll}
                    />
                  </th>
                  <th className="th">Client</th>
                  <th className="th">Company</th>
                  <th className="th">Phone</th>
                  <th className="th">Status</th>
                  <th className="th">Interest</th>
                  <th className="th">Calls</th>
                  <th className="th">Last Call</th>
                  <th className="th">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {clients.map((c: any) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="td">
                      <input
                        type="checkbox"
                        checked={selected.has(c.id)}
                        onChange={() => toggle(c.id)}
                      />
                    </td>
                    <td className="td">
                      <Link href={`/clients/${c.id}`} className="font-medium text-brand-700 hover:underline">
                        {c.firstName} {c.lastName}
                      </Link>
                      {c.email && <div className="text-xs text-slate-400">{c.email}</div>}
                    </td>
                    <td className="td">{c.companyName || "—"}</td>
                    <td className="td font-mono text-xs">{c.phone}</td>
                    <td className="td"><StatusBadge status={c.status} /></td>
                    <td className="td"><InterestBadge level={c.interestLevel} /></td>
                    <td className="td">{c.callCount}</td>
                    <td className="td text-xs">{formatDate(c.lastCallAt)}</td>
                    <td className="td">
                      <div className="flex gap-1">
                        <Link href={`/clients/${c.id}`} className="btn-ghost px-2 py-1 text-xs" title="View report">
                          👁
                        </Link>
                        <button
                          className="btn-ghost px-2 py-1 text-xs"
                          onClick={() => setEditClient(c)}
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          className="btn-ghost px-2 py-1 text-xs disabled:opacity-30"
                          onClick={() => callClient(c.id)}
                          disabled={c.doNotCall}
                          title={c.doNotCall ? "On Do Not Call list" : "Call now"}
                        >
                          📞
                        </button>
                        <button
                          className="btn-ghost px-2 py-1 text-xs text-red-500"
                          onClick={() => setDeleteId(c.id)}
                          title="Delete"
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pagination && (
              <Pagination
                page={pagination.page}
                totalPages={pagination.totalPages}
                onChange={setPage}
              />
            )}
          </div>
        )}
      </Card>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Client" size="lg">
        <ClientForm onSubmit={createClient} onCancel={() => setShowAdd(false)} submitLabel="Add Client" />
      </Modal>

      <Modal open={!!editClient} onClose={() => setEditClient(null)} title="Edit Client" size="lg">
        {editClient && (
          <ClientForm
            initial={editClient}
            onSubmit={updateClient}
            onCancel={() => setEditClient(null)}
            submitLabel="Save Changes"
          />
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete client"
        message="This will permanently delete the client and their call history. Continue?"
        confirmLabel="Delete"
        danger
        onConfirm={removeClient}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
