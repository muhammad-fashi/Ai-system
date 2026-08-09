"use client";
import Link from "next/link";
import useSWR from "swr";
import { fetcher } from "@/lib/client";
import { PageHeader, Card, StatusBadge, EmptyState, Spinner } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export default function CampaignsPage() {
  const { data, isLoading } = useSWR("/api/campaigns", fetcher, {
    refreshInterval: 15000,
  });
  const campaigns = data?.campaigns || [];

  return (
    <div>
      <PageHeader
        title="Calling Campaigns"
        subtitle="Manage your outbound calling campaigns"
        actions={
          <Link href="/start-calling" className="btn-primary">
            + New Campaign
          </Link>
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner className="text-brand-600" />
        </div>
      ) : campaigns.length === 0 ? (
        <Card>
          <EmptyState
            icon="📣"
            title="No campaigns yet"
            description="Start your first outbound calling campaign."
            action={
              <Link href="/start-calling" className="btn-primary">
                🚀 Start Calling
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {campaigns.map((c: any) => (
            <Link key={c.id} href={`/campaigns/${c.id}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-slate-900">{c.name}</h3>
                  <StatusBadge status={c.status} />
                </div>
                {c.description && (
                  <p className="mb-3 line-clamp-2 text-sm text-slate-500">{c.description}</p>
                )}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg bg-slate-50 p-2">
                    <p className="text-xs text-slate-400">Leads</p>
                    <p className="font-semibold">{c._count?.campaignClients ?? 0}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2">
                    <p className="text-xs text-slate-400">Calls</p>
                    <p className="font-semibold">{c._count?.calls ?? 0}</p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-slate-400">Created {formatDate(c.createdAt)}</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
