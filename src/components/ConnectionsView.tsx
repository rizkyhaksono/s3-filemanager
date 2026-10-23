"use client";

import Link from "next/link";
import { useState } from "react";
import { Database, Globe, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/client";
import { PROVIDERS, type Connection } from "@/lib/types";
import { ConnectionForm } from "./ConnectionForm";
import { Button, ConfirmDialog, useToast } from "./ui";

export function ConnectionsView({ initial }: { initial: Connection[] }) {
  const toast = useToast();
  const [items, setItems] = useState(initial);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Connection | null>(null);
  const [deleting, setDeleting] = useState<Connection | null>(null);

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const onSaved = (c: Connection) => {
    setItems((list) => {
      const rest = list.filter((x) => x.id !== c.id);
      return [...rest, c].sort((a, b) => a.name.localeCompare(b.name));
    });
    setFormOpen(false);
  };

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Koneksi Storage</h1>
          <p className="mt-0.5 text-sm text-muted">
            Sambungkan bucket S3 atau layanan S3-compatible, lalu kelola file-nya dari sini.
          </p>
        </div>
        {items.length > 0 && (
          <Button variant="primary" onClick={openNew}>
            <Plus className="size-4" /> Tambah koneksi
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-line bg-surface px-6 py-16 text-center">
          <span className="mb-4 grid size-12 place-items-center rounded-xl bg-accent-soft text-accent">
            <Database className="size-6" />
          </span>
          <h2 className="font-semibold">Belum ada koneksi</h2>
          <p className="mt-1 max-w-sm text-sm text-muted">
            Tambahkan kredensial AWS S3, Cloudflare R2, MinIO, atau penyedia S3-compatible lainnya.
          </p>
          <Button variant="primary" className="mt-5" onClick={openNew}>
            <Plus className="size-4" /> Tambah koneksi pertama
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((c) => (
            <div
              key={c.id}
              className="group relative rounded-xl border border-line bg-surface p-4 shadow-sm transition hover:border-faint hover:shadow-md"
            >
              <Link href={`/c/${c.id}`} className="absolute inset-0 rounded-xl" aria-label={`Buka ${c.name}`} />
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold">{c.name}</h3>
                  <span className="text-xs text-muted">
                    {PROVIDERS.find((p) => p.id === c.provider)?.label ?? c.provider}
                  </span>
                </div>
                <div className="relative z-10 flex opacity-60 transition group-hover:opacity-100">
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Edit"
                    onClick={() => {
                      setEditing(c);
                      setFormOpen(true);
                    }}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" title="Hapus" onClick={() => setDeleting(c)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
              <dl className="mt-4 space-y-1.5 text-[13px] text-muted">
                <div className="flex items-center gap-2">
                  <Globe className="size-3.5 shrink-0" />
                  <span className="truncate font-mono text-xs">{c.endpoint || "AWS S3"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="size-3.5 shrink-0" />
                  <span>{c.region}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Database className="size-3.5 shrink-0" />
                  <span className="truncate">{c.bucket || "Semua bucket"}</span>
                </div>
              </dl>
            </div>
          ))}
        </div>
      )}

      <ConnectionForm open={formOpen} editing={editing} onClose={() => setFormOpen(false)} onSaved={onSaved} />

      <ConfirmDialog
        open={!!deleting}
        title="Hapus koneksi?"
        message={
          <>
            Koneksi <b className="text-fg">{deleting?.name}</b> akan dihapus dari aplikasi ini. File di bucket
            tidak akan terhapus.
          </>
        }
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await api(`/api/connections/${deleting.id}`, { method: "DELETE" });
            setItems((l) => l.filter((x) => x.id !== deleting.id));
            toast("success", "Koneksi dihapus");
            setDeleting(null);
          } catch (e) {
            toast("error", (e as Error).message);
          }
        }}
      />
    </>
  );
}
