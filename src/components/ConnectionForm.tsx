"use client";

import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { api } from "@/lib/client";
import { PROVIDERS, type Connection } from "@/lib/types";
import { Button, Field, Input, Modal, useToast } from "./ui";

type FormState = {
  name: string;
  provider: string;
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  forcePathStyle: boolean;
};

const empty: FormState = {
  name: "",
  provider: "aws",
  endpoint: "",
  region: "us-east-1",
  accessKeyId: "",
  secretAccessKey: "",
  bucket: "",
  forcePathStyle: false,
};

type Props = {
  open: boolean;
  editing: Connection | null;
  onClose: () => void;
  onSaved: (c: Connection) => void;
};

/** Mounted only while open so the form state starts fresh each time. */
export function ConnectionForm(props: Props) {
  return props.open ? <ConnectionFormInner {...props} /> : null;
}

function ConnectionFormInner({ open, editing, onClose, onSaved }: Props) {
  const toast = useToast();
  const [f, setF] = useState<FormState>(() =>
    editing
      ? {
          name: editing.name,
          provider: editing.provider,
          endpoint: editing.endpoint ?? "",
          region: editing.region,
          accessKeyId: editing.accessKeyId,
          secretAccessKey: "",
          bucket: editing.bucket ?? "",
          forcePathStyle: editing.forcePathStyle,
        }
      : empty,
  );
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<{ ok: boolean; message: string } | null>(null);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));

  const pickProvider = (id: string) => {
    const p = PROVIDERS.find((x) => x.id === id)!;
    setF((s) => ({ ...s, provider: id, endpoint: p.endpoint, region: p.region, forcePathStyle: p.forcePathStyle }));
  };

  const payload = () => ({ ...f, id: editing?.id });

  const runTest = async () => {
    setTesting(true);
    setTest(null);
    try {
      const r = await api<{ message: string }>("/api/connections/test", { method: "POST", json: payload() });
      setTest({ ok: true, message: r.message });
    } catch (e) {
      setTest({ ok: false, message: (e as Error).message });
    } finally {
      setTesting(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const saved = editing
        ? await api<Connection>(`/api/connections/${editing.id}`, { method: "PUT", json: payload() })
        : await api<Connection>("/api/connections", { method: "POST", json: payload() });
      toast("success", editing ? "Koneksi diperbarui" : "Koneksi ditambahkan");
      onSaved(saved);
    } catch (e) {
      toast("error", (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const preset = PROVIDERS.find((p) => p.id === f.provider);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Edit koneksi — ${editing.name}` : "Tambah koneksi S3"}
      width="max-w-2xl"
      footer={
        <>
          <Button variant="secondary" loading={testing} onClick={runTest} className="mr-auto">
            Tes koneksi
          </Button>
          <Button variant="ghost" onClick={onClose}>Batal</Button>
          <Button variant="primary" loading={saving} onClick={save}>Simpan</Button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <span className="mb-2 block text-[13px] font-medium">Provider</span>
          <div className="flex flex-wrap gap-1.5">
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => pickProvider(p.id)}
                className={`rounded-full border px-3 py-1 text-[13px] transition ${
                  f.provider === p.id
                    ? "border-accent bg-accent-soft text-accent font-medium"
                    : "border-line text-muted hover:text-fg hover:border-faint"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nama koneksi">
            <Input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="mis. Backup Produksi" autoFocus />
          </Field>
          <Field label="Bucket default" hint="Opsional. Kosongkan untuk melihat semua bucket.">
            <Input value={f.bucket} onChange={(e) => set("bucket", e.target.value)} placeholder="my-bucket" />
          </Field>
          <Field label="Endpoint" hint={preset?.hint}>
            <Input value={f.endpoint} onChange={(e) => set("endpoint", e.target.value)} placeholder="https://s3.example.com" />
          </Field>
          <Field label="Region">
            <Input value={f.region} onChange={(e) => set("region", e.target.value)} placeholder="us-east-1" />
          </Field>
          <Field label="Access Key ID">
            <Input value={f.accessKeyId} onChange={(e) => set("accessKeyId", e.target.value)} autoComplete="off" className="font-mono" />
          </Field>
          <Field label="Secret Access Key" hint={editing ? "Kosongkan jika tidak ingin mengganti." : "Disimpan terenkripsi (AES-256-GCM)."}>
            <Input
              type="password"
              value={f.secretAccessKey}
              onChange={(e) => set("secretAccessKey", e.target.value)}
              placeholder={editing ? "••••••••" : ""}
              autoComplete="new-password"
              className="font-mono"
            />
          </Field>
        </div>

        <label className="flex cursor-pointer items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={f.forcePathStyle}
            onChange={(e) => set("forcePathStyle", e.target.checked)}
            className="mt-0.5 size-4 accent-[var(--accent)]"
          />
          <span>
            <span className="font-medium">Path-style URL</span>
            <span className="block text-xs text-muted">
              Pakai <code className="font-mono">endpoint/bucket/key</code> alih-alih <code className="font-mono">bucket.endpoint/key</code>. Biasanya wajib untuk MinIO & R2.
            </span>
          </span>
        </label>

        {test && (
          <div
            className={`flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm ${
              test.ok ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-red-500/10 text-red-700 dark:text-red-400"
            }`}
          >
            {test.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <XCircle className="mt-0.5 size-4 shrink-0" />}
            <span className="break-words">{test.message}</span>
          </div>
        )}
      </div>
    </Modal>
  );
}
