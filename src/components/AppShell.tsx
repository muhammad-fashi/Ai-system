"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { api, fetcher } from "@/lib/client";
import { useToast } from "@/components/ui/Toast";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/clients", label: "Clients", icon: "👥" },
  { href: "/import", label: "Import Clients", icon: "📥" },
  { href: "/campaigns", label: "Calling Campaigns", icon: "📣" },
  { href: "/start-calling", label: "Start Calling", icon: "🚀" },
  { href: "/active-calls", label: "Active Calls", icon: "📡" },
  { href: "/reports", label: "Call Reports", icon: "📄" },
  { href: "/history", label: "Call History", icon: "🕑" },
  { href: "/followups", label: "Follow-ups", icon: "🔔" },
  { href: "/do-not-call", label: "Do Not Call", icon: "🚫" },
  { href: "/services", label: "Services", icon: "🧩" },
  { href: "/ai-agent", label: "AI Agent", icon: "🤖" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export default function AppShell({
  user,
  children,
}: {
  user: { name: string; email: string; role: string };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: notif } = useSWR("/api/notifications", fetcher, {
    refreshInterval: 30000,
  });

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    toast("Signed out", "info");
    router.push("/login");
    router.refresh();
  }

  const NavLinks = () => (
    <nav className="flex flex-col gap-1 px-3">
      {NAV.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-brand-50 text-brand-700"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-[var(--border)] bg-white lg:flex">
        <div className="flex h-16 items-center gap-2 px-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
            📞
          </span>
          <span className="font-bold text-slate-900">AI Caller</span>
        </div>
        <div className="flex-1 overflow-y-auto pb-4">
          <NavLinks />
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-64 overflow-y-auto bg-white shadow-xl">
            <div className="flex h-16 items-center justify-between px-5">
              <span className="font-bold">AI Caller</span>
              <button onClick={() => setMobileOpen(false)} className="text-2xl">
                ×
              </button>
            </div>
            <NavLinks />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top nav */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-[var(--border)] bg-white/90 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <button
              className="btn-ghost p-2 lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              ☰
            </button>
            <Link href="/start-calling" className="btn-primary hidden sm:inline-flex">
              🚀 Start AI Calling
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/followups" className="relative rounded-lg p-2 hover:bg-slate-100">
              🔔
              {notif?.unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] text-white">
                  {notif.unread}
                </span>
              )}
            </Link>
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-tight text-slate-800">
                {user.name}
              </p>
              <p className="text-xs text-slate-400">{user.role}</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <button onClick={logout} className="btn-secondary px-3 py-1.5 text-xs">
              Sign out
            </button>
          </div>
        </header>

        <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
