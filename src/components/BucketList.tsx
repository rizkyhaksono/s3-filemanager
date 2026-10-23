"use client";

import { useCallback, useEffect, useState } from "react";
import { Database, Plus, RefreshCw, Trash2 } from "lucide-react";
import { api, formatDate } from "@/lib/client";
import type { BucketInfo } from "@/lib/types";
import { Button, ConfirmDialog, PromptDialog, Spinner, useToast } from "./ui";

export function BucketList({ connId, onOpen }: { connId: number; onOpen: (bucket: string) => void }) {
  const toast = useToast();
  const [buckets, setBuckets] = useState<BucketInfo[] | null>(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchBuckets = useCallback(
    () =>
      api<BucketInfo[]>(`/api/s3/${connId}/buckets`).then(
        (b) => {
          setError("");
          setBuckets(b);
        },
        (e) => {
          setError((e as Error).message);
          setBuckets([]);
        },
      ),
    [connId],
  );

  const load = () => {
    setBuckets(null);
    fetchBuckets();
  };

  useEffect(() => {
    fetchBuckets();
  }, [fetchBuckets]);

  return (
    <div className="rounded-xl border border-line bg-surface shadow-sm">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold">Bucket</h2>
        <div className="flex gap-1.5">
          <Button size="sm" variant="ghost" onClick={load} title="Muat ulang">
            <RefreshCw className="size-3.5" />
          </Button>
          <Button size="sm" variant="primary" onClick={() => setCreating(true)}>
            <Plus className="size-3.5" /> Bucket baru
          </Button>
        </div>
      </div>

      {buckets === null ? (
        <Spinner className="mx-auto my-16" />
      ) : error ? (
        <div className="px-4 py-12 text-center text-sm text-red-600">{error}</div>
      ) : buckets.length === 0 ? (
        <div className="px-4 py-12 text-center text-sm text-muted">Belum ada bucket.</div>
      ) : (
        <ul className="divide-y divide-line">
          {buckets.map((b) => (
            <li key={b.name} className="group flex items-center gap-3 px-4 py-2.5 hover:bg-subtle/60">
              <button onClick={() => onOpen(b.name)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <span className="grid size-8 place-items-center rounded-lg bg-accent-soft text-accent">
                  <Database className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{b.name}</span>
                  <span className="text-xs text-muted">Dibuat {formatDate(b.createdAt)}</span>
                </span>
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="opacity-0 group-hover:opacity-100"
                title="Hapus bucket"
                onClick={() => setDeleting(b.name)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <PromptDialog
        open={creating}
        title="Bucket baru"
        label="Nama bucket"
        confirmLabel="Buat"
        onClose={() => setCreating(false)}
        onSubmit={async (name) => {
          try {
            await api(`/api/s3/${connId}/buckets`, { method: "POST", json: { name } });
            toast("success", `Bucket "${name}" dibuat`);
            setCreating(false);
            load();
          } catch (e) {
            toast("error", (e as Error).message);
          }
        }}
      />
      <ConfirmDialog
        open={!!deleting}
        title="Hapus bucket?"
        message={
          <>
            Bucket <b className="text-fg">{deleting}</b> akan dihapus. Bucket harus kosong terlebih dahulu.
          </>
        }
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          try {
            await api(`/api/s3/${connId}/buckets?bucket=${encodeURIComponent(deleting!)}`, { method: "DELETE" });
            toast("success", "Bucket dihapus");
            setDeleting(null);
            load();
          } catch (e) {
            toast("error", (e as Error).message);
          }
        }}
      />
    </div>
  );
}
