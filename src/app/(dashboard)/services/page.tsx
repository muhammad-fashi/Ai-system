"use client";
import { useState } from "react";
import useSWR from "swr";
import { api, fetcher } from "@/lib/client";
import { PageHeader, Card, Spinner, EmptyState } from "@/components/ui";
import { AGENCY_SERVICES } from "@/lib/validation";
import { useToast } from "@/components/ui/Toast";

export default function ServicesPage() {
  const { toast } = useToast();
  const { data, isLoading, mutate } = useSWR("/api/services", fetcher);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const services = data?.services || [];

  async function add(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/api/services", { method: "POST", body: JSON.stringify({ name, description }) });
      toast("Service saved", "success");
      setName("");
      setDescription("");
      mutate();
    } catch (err) {
      toast((err as Error).message, "error");
    }
  }
  async function toggle(s: any) {
    await api(`/api/services/${s.id}`, { method: "PUT", body: JSON.stringify({ active: !s.active }) });
    mutate();
  }
  async function seedDefaults() {
    for (const s of AGENCY_SERVICES) {
      await api("/api/services", { method: "POST", body: JSON.stringify({ name: s }) }).catch(() => {});
    }
    toast("Default services added", "success");
    mutate();
  }
  async function remove(id: string) {
    await api(`/api/services/${id}`, { method: "DELETE" });
    mutate();
  }

  return (
    <div>
      <PageHeader
        title="Services"
        subtitle="The services your AI agent can discuss and offer"
        actions={
          services.length === 0 ? (
            <button className="btn-secondary" onClick={seedDefaults}>Add default services</button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <h3 className="mb-3 font-semibold">Add a service</h3>
          <form onSubmit={add} className="space-y-3">
            <div>
              <label className="label">Name</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Website Redesign" />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea className="input min-h-[80px]" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <button className="btn-primary w-full">Add Service</button>
          </form>
        </Card>

        <div className="lg:col-span-2">
          {isLoading ? (
            <div className="flex justify-center py-16"><Spinner className="text-brand-600" /></div>
          ) : services.length === 0 ? (
            <Card><EmptyState icon="🧩" title="No services" description="Add the services your agency offers." /></Card>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {services.map((s: any) => (
                <Card key={s.id} className={s.active ? "" : "opacity-60"}>
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-semibold">{s.name}</h4>
                    <button
                      className={`badge cursor-pointer ${s.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
                      onClick={() => toggle(s)}
                    >
                      {s.active ? "Active" : "Inactive"}
                    </button>
                  </div>
                  {s.description && <p className="mt-1 text-sm text-slate-500">{s.description}</p>}
                  <button className="mt-2 text-xs text-red-500 hover:underline" onClick={() => remove(s.id)}>
                    Delete
                  </button>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
