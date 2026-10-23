"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { HardDrive } from "lucide-react";
import { Button, Field, Input } from "@/components/ui";

export function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      router.replace("/");
      router.refresh();
    } else {
      setError((await res.json().catch(() => ({}))).error || "Gagal login");
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl border border-line bg-surface p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-lg bg-accent text-white">
            <HardDrive className="size-5" />
          </span>
          <div>
            <h1 className="font-semibold">S3 File Manager</h1>
            <p className="text-xs text-muted">Masuk untuk melanjutkan</p>
          </div>
        </div>
        <Field label="Password">
          <Input type="password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <Button type="submit" variant="primary" loading={busy} className="mt-5 w-full justify-center">
          Masuk
        </Button>
      </form>
    </div>
  );
}
