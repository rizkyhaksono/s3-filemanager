"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, Loader2, X, XCircle } from "lucide-react";
import { formatBytes, uploadFile } from "@/lib/client";

export type PickedFile = { file: File; path: string };

type Task = {
  id: number;
  name: string;
  bucket: string;
  key: string;
  file: File;
  loaded: number;
  status: "queued" | "uploading" | "done" | "error";
  error?: string;
  abort?: () => void;
};

const CONCURRENCY = 3;
let nextId = 1;

/** Upload queue with limited concurrency and per-file progress. */
export function useUploads(connId: number, onFileDone: () => void) {
  // The ref is the source of truth for scheduling; state is a render snapshot.
  const list = useRef<Task[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const running = useRef(0);
  const doneCb = useRef(onFileDone);
  useEffect(() => {
    doneCb.current = onFileDone;
  }, [onFileDone]);

  const sync = useCallback(() => setTasks(list.current.map((t) => ({ ...t }))), []);
  const patch = useCallback(
    (id: number, p: Partial<Task>) => {
      const t = list.current.find((x) => x.id === id);
      if (t) Object.assign(t, p);
      sync();
    },
    [sync],
  );

  const pumpRef = useRef<() => void>(() => {});
  const pump = useCallback(() => {
    for (const t of list.current) {
      if (running.current >= CONCURRENCY) break;
      if (t.status !== "queued") continue;
      running.current++;
      const { promise, abort } = uploadFile(connId, t.bucket, t.key, t.file, (loaded) => patch(t.id, { loaded }));
      Object.assign(t, { status: "uploading", abort });
      promise
        .then(() => {
          patch(t.id, { status: "done", loaded: t.file.size });
          doneCb.current();
        })
        .catch((e) => patch(t.id, { status: "error", error: (e as Error).message }))
        .finally(() => {
          running.current--;
          pumpRef.current();
        });
    }
    sync();
  }, [connId, patch, sync]);
  useEffect(() => {
    pumpRef.current = pump;
  }, [pump]);

  const enqueue = useCallback(
    (bucket: string, prefix: string, files: PickedFile[]) => {
      for (const { file, path } of files) {
        list.current.push({
          id: nextId++,
          name: path,
          bucket,
          key: prefix + path,
          file,
          loaded: 0,
          status: "queued",
        });
      }
      pump();
    },
    [pump],
  );

  const cancel = (id: number) => {
    const t = list.current.find((x) => x.id === id);
    if (t?.status === "uploading") t.abort?.();
    if (t?.status === "queued") list.current = list.current.filter((x) => x.id !== id);
    sync();
  };

  const clearFinished = () => {
    list.current = list.current.filter((t) => t.status === "queued" || t.status === "uploading");
    sync();
  };

  return { tasks, enqueue, cancel, clearFinished };
}

export function UploadPanel({
  tasks,
  onCancel,
  onClear,
}: {
  tasks: Task[];
  onCancel: (id: number) => void;
  onClear: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  if (tasks.length === 0) return null;

  const active = tasks.filter((t) => t.status === "queued" || t.status === "uploading").length;
  const failed = tasks.filter((t) => t.status === "error").length;
  const total = tasks.reduce((s, t) => s + t.file.size, 0);
  const loaded = tasks.reduce((s, t) => s + t.loaded, 0);
  const pct = total ? Math.round((loaded / total) * 100) : 100;

  return (
    <div className="fixed right-4 bottom-4 z-40 w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-line bg-surface shadow-2xl animate-in">
      <div className="flex items-center gap-2 border-b border-line px-3.5 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            {active ? `Mengupload ${active} file… ${pct}%` : failed ? `${failed} upload gagal` : "Upload selesai"}
          </p>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-subtle">
            <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <button onClick={() => setCollapsed((c) => !c)} className="rounded p-1 text-muted hover:bg-subtle">
          {collapsed ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>
        {!active && (
          <button onClick={onClear} className="rounded p-1 text-muted hover:bg-subtle" title="Tutup">
            <X className="size-4" />
          </button>
        )}
      </div>
      {!collapsed && (
        <ul className="max-h-72 overflow-y-auto py-1">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-center gap-2.5 px-3.5 py-1.5 text-[13px]">
              <span className="shrink-0">
                {t.status === "done" ? (
                  <CheckCircle2 className="size-4 text-emerald-500" />
                ) : t.status === "error" ? (
                  <XCircle className="size-4 text-red-500" />
                ) : t.status === "uploading" ? (
                  <Loader2 className="size-4 animate-spin text-accent" />
                ) : (
                  <span className="block size-4 rounded-full border-2 border-line" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate" title={t.key}>{t.name}</span>
                <span className={`block text-xs ${t.status === "error" ? "text-red-600" : "text-muted"}`}>
                  {t.status === "error"
                    ? t.error
                    : t.status === "uploading"
                      ? `${formatBytes(t.loaded)} / ${formatBytes(t.file.size)}`
                      : formatBytes(t.file.size)}
                </span>
              </span>
              {(t.status === "queued" || t.status === "uploading") && (
                <button onClick={() => onCancel(t.id)} className="rounded p-0.5 text-muted hover:text-fg" title="Batal">
                  <X className="size-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Collect files from a drop event, walking into dropped folders. */
export async function filesFromDrop(dt: DataTransfer): Promise<PickedFile[]> {
  const entries = [...dt.items]
    .map((i) => (i.kind === "file" ? i.webkitGetAsEntry?.() : null))
    .filter((e): e is FileSystemEntry => !!e);
  if (entries.length === 0) return [...dt.files].map((file) => ({ file, path: file.name }));

  const out: PickedFile[] = [];
  const walk = async (entry: FileSystemEntry, base: string): Promise<void> => {
    if (entry.isFile) {
      const file = await new Promise<File>((res, rej) => (entry as FileSystemFileEntry).file(res, rej));
      out.push({ file, path: base + entry.name });
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      // readEntries returns results in batches until it returns an empty array.
      for (;;) {
        const batch = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej));
        if (!batch.length) break;
        for (const child of batch) await walk(child, `${base}${entry.name}/`);
      }
    }
  };
  for (const e of entries) await walk(e, "");
  return out;
}
