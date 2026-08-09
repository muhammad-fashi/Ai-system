"use client";
import { useState } from "react";
import useSWR from "swr";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { fetcher } from "@/lib/client";
import { PageHeader, StatCard, Card, Spinner } from "@/components/ui";
import { titleCase } from "@/lib/utils";

const RANGES = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "Last 7 Days" },
  { key: "30d", label: "Last 30 Days" },
  { key: "custom", label: "Custom" },
];

export default function DashboardPage() {
  const [range, setRange] = useState("30d");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const query =
    range === "custom" && custom.from && custom.to
      ? `range=custom&from=${custom.from}&to=${custom.to}`
      : `range=${range}`;
  const { data, isLoading } = useSWR(`/api/dashboard/stats?${query}`, fetcher, {
    refreshInterval: 20000,
  });

  const c = data?.cards;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Overview of your outbound calling performance"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                className={
                  range === r.key ? "btn-primary px-3 py-1.5" : "btn-secondary px-3 py-1.5"
                }
              >
                {r.label}
              </button>
            ))}
          </div>
        }
      />

      {range === "custom" && (
        <Card className="mb-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="label">From</label>
              <input
                type="date"
                className="input"
                value={custom.from}
                onChange={(e) => setCustom({ ...custom, from: e.target.value })}
              />
            </div>
            <div>
              <label className="label">To</label>
              <input
                type="date"
                className="input"
                value={custom.to}
                onChange={(e) => setCustom({ ...custom, to: e.target.value })}
              />
            </div>
          </div>
        </Card>
      )}

      {isLoading || !c ? (
        <div className="flex justify-center py-20">
          <Spinner className="text-brand-600" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard label="Total Clients" value={c.totalClients} icon="👥" accent="brand" />
            <StatCard label="Total Calls" value={c.totalCalls} icon="📞" accent="violet" />
            <StatCard label="Successful Calls" value={c.successfulCalls} icon="✅" accent="green" />
            <StatCard label="Failed Calls" value={c.failedCalls} icon="⚠️" accent="red" />
            <StatCard label="Interested Leads" value={c.interestedLeads} icon="🔥" accent="amber" />
            <StatCard label="Follow-ups" value={c.followUps} icon="🔔" accent="amber" />
            <StatCard label="Meetings Booked" value={c.meetings} icon="📅" accent="violet" />
            <StatCard label="Conversion Rate" value={`${c.conversionRate}%`} icon="📈" accent="green" />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <h3 className="mb-4 font-semibold text-slate-800">Calling Activity</h3>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.chart}>
                    <defs>
                      <linearGradient id="cCalls" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3366ff" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3366ff" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef1f6" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => d.slice(5)} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Area type="monotone" dataKey="calls" name="Calls" stroke="#3366ff" fill="url(#cCalls)" />
                    <Area type="monotone" dataKey="successful" name="Successful" stroke="#10b981" fillOpacity={0} />
                    <Area type="monotone" dataKey="failed" name="Failed" stroke="#ef4444" fillOpacity={0} />
                    <Area type="monotone" dataKey="interested" name="Interested" stroke="#f59e0b" fillOpacity={0} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card>
              <h3 className="mb-4 font-semibold text-slate-800">Outcomes</h3>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={(data.outcomes || []).map((o: any) => ({
                      name: titleCase(o.outcome),
                      count: o.count,
                    }))}
                    layout="vertical"
                    margin={{ left: 20 }}
                  >
                    <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={110} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3366ff" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
