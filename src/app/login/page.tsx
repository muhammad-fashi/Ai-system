"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/client";
import { Spinner } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-brand-800">
          <Spinner className="text-white" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { toast } = useToast();
  const [setupRequired, setSetupRequired] = useState<boolean | null>(null);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api<{ setupRequired: boolean }>("/api/auth/register")
      .then((d) => {
        setSetupRequired(d.setupRequired);
        setMode(d.setupRequired ? "register" : "login");
      })
      .catch(() => setSetupRequired(false));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const url = mode === "register" ? "/api/auth/register" : "/api/auth/login";
      await api(url, { method: "POST", body: JSON.stringify(form) });
      toast(mode === "register" ? "Admin account created" : "Welcome back", "success");
      router.push(params.get("next") || "/dashboard");
      router.refresh();
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-600 to-brand-900 p-4">
      <div className="card w-full max-w-md p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-2xl">
            📞
          </div>
          <h1 className="text-xl font-bold text-slate-900">AI Outbound Calling</h1>
          <p className="mt-1 text-sm text-slate-500">
            {mode === "register"
              ? "Create your admin account to get started"
              : "Sign in to your dashboard"}
          </p>
        </div>

        {setupRequired === null ? (
          <div className="flex justify-center py-8">
            <Spinner className="text-brand-600" />
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {mode === "register" && (
              <div>
                <label className="label">Full name</label>
                <input
                  className="input"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Jane Admin"
                />
              </div>
            )}
            <div>
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="you@agency.com"
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                className="input"
                type="password"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••"
              />
            </div>
            <button className="btn-primary w-full" disabled={loading}>
              {loading ? <Spinner /> : mode === "register" ? "Create account" : "Sign in"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
