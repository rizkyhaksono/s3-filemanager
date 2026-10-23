"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ChevronRight,
  Copy,
  Database,
  Download,
  Eye,
  FolderInput,
  FolderPlus,
  FolderUp,
  Home,
  Info,
  Link2,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { api, formatBytes, formatDate, isPreviewable, qs } from "@/lib/client";
import { ENV_CONNECTION_ID, type Connection, type Entry, type FileEntry, type ListResult } from "@/lib/types";
import { BucketList } from "./BucketList";
import { FileIcon } from "./FileIcon";
import { Menu } from "./Menu";
import { PreviewModal } from "./PreviewModal";
import { filesFromDrop, UploadPanel, useUploads, type PickedFile } from "./uploads";
import { Button, ConfirmDialog, Field, Input, Modal, PromptDialog, Spinner, useToast } from "./ui";

type SortKey = "name" | "size" | "date";
type Dialog =
  | { type: "newFolder" }
  | { type: "rename"; entry: Entry }
  | { type: "move"; entries: Entry[] }
  | { type: "delete"; entries: Entry[] }
  | { type: "share"; file: FileEntry }
  | { type: "info"; file: FileEntry }
  | null;

export function FileManager({ conn }: { conn: Connection }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const toast = useToast();

  const bucket = sp.get("b") || conn.bucket || "";
  const prefix = sp.get("p") || "";

  const [entries, setEntries] = useState<Entry[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "name", dir: 1 });
  const [dialog, setDialog] = useState<Dialog>(null);
  const [preview, setPreview] = useState<FileEntry | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  const go = useCallback(
    (b: string, p = "") => router.push(`${pathname}?${qs({ b: b === conn.bucket ? undefined : b, p })}`),
    [router, pathname, conn.bucket],
  );

  // Reset per-folder UI state when the location changes (during render, not in an effect).
  const location = `${bucket}\n${prefix}`;
  const [shownLocation, setShownLocation] = useState<string | null>(null);
  if (shownLocation !== location) {
    setShownLocation(location);
    setSelected(new Set());
    setFilter("");
    setLoading(!!bucket);
    setError("");
    setEntries([]);
    setNextToken(null);
  }

  // Ignore responses from folders we've already navigated away from.
  const requestId = useRef(0);
  const fetchList = useCallback(() => {
    const id = ++requestId.current;
    return api<ListResult>(`/api/s3/${conn.id}/objects?${qs({ bucket, prefix })}`)
      .then(
        (r) => {
          if (id !== requestId.current) return;
          setEntries(r.entries);
          setNextToken(r.nextToken);
          setError("");
        },
        (e) => {
          if (id !== requestId.current) return;
          setError((e as Error).message);
          setEntries([]);
          setNextToken(null);
        },
      )
      .finally(() => id === requestId.current && setLoading(false));
  }, [conn.id, bucket, prefix]);

  const load = useCallback(() => {
    setLoading(true);
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    if (bucket) fetchList();
  }, [bucket, fetchList]);

  const loadMore = async () => {
    if (!nextToken) return;
    setLoadingMore(true);
    try {
      const r = await api<ListResult>(`/api/s3/${conn.id}/objects?${qs({ bucket, prefix, token: nextToken })}`);
      setEntries((es) => [...es, ...r.entries]);
      setNextToken(r.nextToken);
    } catch (e) {
      toast("error", (e as Error).message);
    } finally {
      setLoadingMore(false);
    }
  };

  // Refresh the listing shortly after uploads finish, batching bursts.
  const reloadTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const scheduleReload = useCallback(() => {
    clearTimeout(reloadTimer.current);
    reloadTimer.current = setTimeout(load, 600);
  }, [load]);
  const uploads = useUploads(conn.id, scheduleReload);

  const visible = useMemo(() => {
    const q = filter.toLowerCase();
    const list = q ? entries.filter((e) => e.name.toLowerCase().includes(q)) : entries;
    return [...list].sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      let d = 0;
      if (sort.key === "size" && a.type === "file" && b.type === "file") d = a.size - b.size;
      else if (sort.key === "date" && a.type === "file" && b.type === "file")
        d = (a.lastModified ?? "").localeCompare(b.lastModified ?? "");
      if (d === 0) d = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
      return d * sort.dir;
    });
  }, [entries, filter, sort]);

  const files = useMemo(() => visible.filter((e): e is FileEntry => e.type === "file"), [visible]);
  const selectedEntries = visible.filter((e) => selected.has(e.key));
  const allSelected = visible.length > 0 && selectedEntries.length === visible.length;

  const toggle = (key: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  /* ---------- actions ---------- */

  const download = async (f: FileEntry) => {
    try {
      const { url } = await api<{ url: string }>(`/api/s3/${conn.id}/url?${qs({ bucket, key: f.key, download: 1 })}`);
      const a = document.createElement("a");
      a.href = url;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      toast("error", (e as Error).message);
    }
  };

  const open = (e: Entry) => {
    if (e.type === "folder") go(bucket, e.key);
    else if (isPreviewable(e.name)) setPreview(e);
    else download(e);
  };

  const navigatePreview = useCallback(
    (dir: -1 | 1) => {
      setPreview((cur) => {
        if (!cur) return cur;
        const previewable = files.filter((f) => isPreviewable(f.name));
        const i = previewable.findIndex((f) => f.key === cur.key);
        return previewable[(i + dir + previewable.length) % previewable.length] ?? cur;
      });
    },
    [files],
  );

  const startUpload = (picked: PickedFile[]) => {
    if (!picked.length) return;
    uploads.enqueue(bucket, prefix, picked);
  };

  const rename = async (entry: Entry, newName: string) => {
    const clean = newName.replace(/\//g, "");
    if (!clean) return;
    const to = prefix + clean + (entry.type === "folder" ? "/" : "");
    await moveEntries([entry], () => to);
  };

  const moveEntries = async (list: Entry[], target: (e: Entry) => string) => {
    try {
      for (const e of list) {
        await api(`/api/s3/${conn.id}/rename`, { method: "POST", json: { bucket, from: e.key, to: target(e) } });
      }
      toast("success", list.length > 1 ? `${list.length} item dipindahkan` : "Berhasil");
      setDialog(null);
      load();
    } catch (e) {
      toast("error", (e as Error).message);
      load();
    }
  };

  const remove = async (list: Entry[]) => {
    try {
      const r = await api<{ deleted: number }>(`/api/s3/${conn.id}/delete`, {
        method: "POST",
        json: {
          bucket,
          keys: list.filter((e) => e.type === "file").map((e) => e.key),
          prefixes: list.filter((e) => e.type === "folder").map((e) => e.key),
        },
      });
      toast("success", `${r.deleted} objek dihapus`);
      setDialog(null);
      setSelected(new Set());
      load();
    } catch (e) {
      toast("error", (e as Error).message);
    }
  };

  /* ---------- keyboard shortcuts ---------- */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (dialog || preview) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "Delete" && selectedEntries.length) setDialog({ type: "delete", entries: selectedEntries });
      if (e.key === "Escape") setSelected(new Set());
      if (e.key === "a" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setSelected(new Set(visible.map((v) => v.key)));
      }
      if (e.key === "Backspace" && prefix) go(bucket, parentOf(prefix));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /* ---------- render ---------- */

  const crumbs = prefix ? prefix.replace(/\/$/, "").split("/") : [];

  if (!bucket) {
    return (
      <>
        <PageHeader conn={conn} />
        <BucketList connId={conn.id} onOpen={(b) => go(b)} />
      </>
    );
  }

  const sortHead = (k: SortKey, label: string, className = "") => (
    <th className={`px-3 py-2 font-medium ${className}`}>
      <button
        className="inline-flex items-center gap-1 hover:text-fg"
        onClick={() => setSort((s) => ({ key: k, dir: s.key === k ? ((-s.dir) as 1 | -1) : 1 }))}
      >
        {label}
        {sort.key === k && (sort.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
      </button>
    </th>
  );

  return (
    <>
      <PageHeader conn={conn} />

      <div
        className="relative flex flex-1 flex-col rounded-xl border border-line bg-surface shadow-sm"
        onDragEnter={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          dragDepth.current++;
          setDragging(true);
        }}
        onDragOver={(e) => e.dataTransfer.types.includes("Files") && e.preventDefault()}
        onDragLeave={() => {
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (dragDepth.current === 0) setDragging(false);
        }}
        onDrop={async (e) => {
          e.preventDefault();
          dragDepth.current = 0;
          setDragging(false);
          startUpload(await filesFromDrop(e.dataTransfer));
        }}
      >
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5">
          <nav className="flex min-w-0 flex-1 items-center gap-0.5 text-sm">
            {!conn.bucket && (
              <>
                <button onClick={() => go("")} className="rounded-md p-1.5 text-muted hover:bg-subtle hover:text-fg" title="Semua bucket">
                  <Home className="size-4" />
                </button>
                <ChevronRight className="size-3.5 shrink-0 text-faint" />
              </>
            )}
            <button
              onClick={() => go(bucket)}
              className="flex shrink-0 items-center gap-1.5 rounded-md px-1.5 py-1 font-medium hover:bg-subtle"
            >
              <Database className="size-3.5 text-accent" />
              {bucket}
            </button>
            {crumbs.map((c, i) => (
              <span key={i} className="flex min-w-0 items-center gap-0.5">
                <ChevronRight className="size-3.5 shrink-0 text-faint" />
                <button
                  onClick={() => go(bucket, crumbs.slice(0, i + 1).join("/") + "/")}
                  className={`truncate rounded-md px-1.5 py-1 hover:bg-subtle ${i === crumbs.length - 1 ? "font-medium" : "text-muted"}`}
                >
                  {c}
                </button>
              </span>
            ))}
          </nav>

          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-faint" />
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Cari di folder ini"
              className="h-8 w-48 pl-8 text-[13px]"
            />
          </div>
          <Button size="sm" variant="ghost" onClick={load} title="Muat ulang">
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button size="sm" onClick={() => setDialog({ type: "newFolder" })}>
            <FolderPlus className="size-3.5" /> Folder
          </Button>
          <Button size="sm" onClick={() => folderInput.current?.click()} title="Upload folder">
            <FolderUp className="size-3.5" />
          </Button>
          <Button size="sm" variant="primary" onClick={() => fileInput.current?.click()}>
            <Upload className="size-3.5" /> Upload
          </Button>
          <input
            ref={fileInput}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              startUpload([...(e.target.files ?? [])].map((file) => ({ file, path: file.name })));
              e.target.value = "";
            }}
          />
          <input
            ref={folderInput}
            type="file"
            hidden
            {...({ webkitdirectory: "" } as object)}
            onChange={(e) => {
              startUpload([...(e.target.files ?? [])].map((file) => ({ file, path: file.webkitRelativePath || file.name })));
              e.target.value = "";
            }}
          />
        </div>

        {/* Selection bar */}
        {selectedEntries.length > 0 && (
          <div className="flex items-center gap-2 border-b border-line bg-accent-soft px-3 py-2 text-sm animate-in">
            <button onClick={() => setSelected(new Set())} className="rounded p-1 hover:bg-black/5 dark:hover:bg-white/5">
              <X className="size-4" />
            </button>
            <span className="font-medium">{selectedEntries.length} dipilih</span>
            <div className="ml-auto flex gap-1.5">
              {selectedEntries.length === 1 && selectedEntries[0].type === "file" && (
                <Button size="sm" onClick={() => download(selectedEntries[0] as FileEntry)}>
                  <Download className="size-3.5" /> Download
                </Button>
              )}
              <Button size="sm" onClick={() => setDialog({ type: "move", entries: selectedEntries })}>
                <FolderInput className="size-3.5" /> Pindahkan
              </Button>
              <Button size="sm" variant="danger" onClick={() => setDialog({ type: "delete", entries: selectedEntries })}>
                <Trash2 className="size-3.5" /> Hapus
              </Button>
            </div>
          </div>
        )}

        {/* Listing */}
        <div className="flex-1 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs text-muted">
              <tr className="border-b border-line">
                <th className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={() => setSelected(allSelected ? new Set() : new Set(visible.map((v) => v.key)))}
                    className="size-3.5 accent-[var(--accent)]"
                    aria-label="Pilih semua"
                  />
                </th>
                {sortHead("name", "Nama")}
                {sortHead("size", "Ukuran", "w-28")}
                {sortHead("date", "Diubah", "w-48")}
                <th className="w-12" />
              </tr>
            </thead>
            <tbody>
              {prefix && (
                <tr className="cursor-pointer border-b border-line/70 hover:bg-subtle/60" onClick={() => go(bucket, parentOf(prefix))}>
                  <td />
                  <td className="px-3 py-2 text-muted" colSpan={4}>
                    <span className="inline-flex items-center gap-2.5">
                      <ArrowLeft className="size-4" /> ..
                    </span>
                  </td>
                </tr>
              )}
              {visible.map((e) => {
                const isSel = selected.has(e.key);
                return (
                  <tr
                    key={e.key}
                    className={`group cursor-default border-b border-line/70 select-none ${isSel ? "bg-row-selected" : "hover:bg-subtle/60"}`}
                    onClick={(ev) => {
                      if (ev.ctrlKey || ev.metaKey || ev.shiftKey) toggle(e.key);
                      else setSelected(new Set([e.key]));
                    }}
                    onDoubleClick={() => open(e)}
                  >
                    <td className="px-3 py-1.5" onClick={(ev) => ev.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSel}
                        onChange={() => toggle(e.key)}
                        className="size-3.5 accent-[var(--accent)]"
                        aria-label={`Pilih ${e.name}`}
                      />
                    </td>
                    <td className="max-w-0 px-3 py-1.5">
                      <button
                        className="flex max-w-full items-center gap-2.5 text-left hover:underline decoration-faint underline-offset-2"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          open(e);
                        }}
                      >
                        <FileIcon name={e.name} folder={e.type === "folder"} className="size-[18px] shrink-0" />
                        <span className="truncate">{e.name}</span>
                      </button>
                    </td>
                    <td className="px-3 py-1.5 text-muted tabular-nums">{e.type === "file" ? formatBytes(e.size) : "—"}</td>
                    <td className="px-3 py-1.5 text-muted tabular-nums">{e.type === "file" ? formatDate(e.lastModified) : "—"}</td>
                    <td className="px-2 py-1" onClick={(ev) => ev.stopPropagation()}>
                      <Menu
                        items={[
                          { label: "Buka", icon: <FolderInput />, onClick: () => open(e), hidden: e.type !== "folder" },
                          { label: "Pratinjau", icon: <Eye />, onClick: () => open(e), hidden: e.type !== "file" || !isPreviewable(e.name) },
                          { label: "Download", icon: <Download />, onClick: () => download(e as FileEntry), hidden: e.type !== "file" },
                          { label: "Bagikan link", icon: <Link2 />, onClick: () => setDialog({ type: "share", file: e as FileEntry }), hidden: e.type !== "file" },
                          { label: "Salin path", icon: <Copy />, onClick: () => copyText(`s3://${bucket}/${e.key}`, toast) },
                          "divider",
                          { label: "Ganti nama", icon: <Pencil />, onClick: () => setDialog({ type: "rename", entry: e }) },
                          { label: "Pindahkan", icon: <FolderInput />, onClick: () => setDialog({ type: "move", entries: [e] }) },
                          { label: "Info", icon: <Info />, onClick: () => setDialog({ type: "info", file: e as FileEntry }), hidden: e.type !== "file" },
                          "divider",
                          { label: "Hapus", icon: <Trash2 />, danger: true, onClick: () => setDialog({ type: "delete", entries: [e] }) },
                        ]}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {loading && entries.length === 0 && <Spinner className="mx-auto my-16" />}
          {error && <p className="px-4 py-12 text-center text-sm text-red-600">{error}</p>}
          {!loading && !error && visible.length === 0 && (
            <div className="flex flex-col items-center px-4 py-16 text-center">
              <Upload className="mb-3 size-8 text-faint" />
              <p className="text-sm font-medium">{filter ? "Tidak ada yang cocok" : "Folder ini kosong"}</p>
              {!filter && <p className="mt-1 text-sm text-muted">Tarik & lepas file ke sini, atau klik Upload.</p>}
            </div>
          )}
          {nextToken && (
            <div className="flex justify-center py-4">
              <Button size="sm" loading={loadingMore} onClick={loadMore}>
                Muat lebih banyak
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-line px-4 py-2 text-xs text-muted">
          <span>
            {visible.filter((e) => e.type === "folder").length} folder · {files.length} file
            {nextToken && " (sebagian)"}
          </span>
          <span>{formatBytes(files.reduce((s, f) => s + f.size, 0))}</span>
        </div>

        {dragging && (
          <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center rounded-xl border-2 border-dashed border-accent bg-accent-soft/80 backdrop-blur-[1px]">
            <div className="text-center">
              <Upload className="mx-auto mb-2 size-8 text-accent" />
              <p className="font-medium text-accent">Lepas untuk upload ke /{prefix}</p>
            </div>
          </div>
        )}
      </div>

      <UploadPanel tasks={uploads.tasks} onCancel={uploads.cancel} onClear={uploads.clearFinished} />

      <PreviewModal
        connId={conn.id}
        bucket={bucket}
        file={preview}
        onClose={() => setPreview(null)}
        onNavigate={navigatePreview}
        onDownload={download}
      />

      <PromptDialog
        open={dialog?.type === "newFolder"}
        title="Folder baru"
        label="Nama folder"
        confirmLabel="Buat"
        onClose={() => setDialog(null)}
        onSubmit={async (name) => {
          try {
            await api(`/api/s3/${conn.id}/folder`, { method: "POST", json: { bucket, prefix, name } });
            setDialog(null);
            load();
          } catch (e) {
            toast("error", (e as Error).message);
          }
        }}
      />

      <PromptDialog
        open={dialog?.type === "rename"}
        title="Ganti nama"
        label="Nama baru"
        initial={dialog?.type === "rename" ? dialog.entry.name : ""}
        onClose={() => setDialog(null)}
        onSubmit={(name) => (dialog?.type === "rename" ? rename(dialog.entry, name) : undefined)}
      />

      <PromptDialog
        open={dialog?.type === "move"}
        title={dialog?.type === "move" && dialog.entries.length > 1 ? `Pindahkan ${dialog.entries.length} item` : "Pindahkan"}
        label="Folder tujuan (kosongkan untuk root bucket)"
        initial={prefix || "/"}
        confirmLabel="Pindahkan"
        onClose={() => setDialog(null)}
        onSubmit={(dest) => {
          if (dialog?.type !== "move") return;
          let folder = dest.replace(/^\/+/, "").replace(/\/+$/, "");
          folder = folder ? folder + "/" : "";
          return moveEntries(dialog.entries, (e) => folder + e.name + (e.type === "folder" ? "/" : ""));
        }}
      />

      <ConfirmDialog
        open={dialog?.type === "delete"}
        title="Hapus permanen?"
        message={
          dialog?.type === "delete" && (
            <>
              {dialog.entries.length === 1 ? (
                <>
                  <b className="text-fg">{dialog.entries[0].name}</b> akan dihapus
                  {dialog.entries[0].type === "folder" && " beserta seluruh isinya"}.
                </>
              ) : (
                <>
                  <b className="text-fg">{dialog.entries.length} item</b> akan dihapus
                  {dialog.entries.some((e) => e.type === "folder") && ", termasuk seluruh isi folder"}.
                </>
              )}{" "}
              Tindakan ini tidak bisa dibatalkan.
            </>
          )
        }
        onClose={() => setDialog(null)}
        onConfirm={() => (dialog?.type === "delete" ? remove(dialog.entries) : undefined)}
      />

      {dialog?.type === "share" && (
        <ShareDialog connId={conn.id} bucket={bucket} file={dialog.file} onClose={() => setDialog(null)} />
      )}
      {dialog?.type === "info" && (
        <InfoDialog connId={conn.id} bucket={bucket} file={dialog.file} onClose={() => setDialog(null)} />
      )}
    </>
  );
}

function parentOf(prefix: string) {
  const parts = prefix.replace(/\/$/, "").split("/");
  parts.pop();
  return parts.length ? parts.join("/") + "/" : "";
}

async function copyText(text: string, toast: ReturnType<typeof useToast>) {
  try {
    await navigator.clipboard.writeText(text);
    toast("success", "Disalin ke clipboard");
  } catch {
    toast("error", "Gagal menyalin");
  }
}

function PageHeader({ conn }: { conn: Connection }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      {conn.id !== ENV_CONNECTION_ID && (
        <Link href="/" className="rounded-lg p-1.5 text-muted hover:bg-subtle hover:text-fg" title="Kembali ke koneksi">
          <ArrowLeft className="size-4" />
        </Link>
      )}
      <div className="min-w-0">
        <h1 className="truncate text-lg font-semibold tracking-tight">{conn.name}</h1>
        <p className="truncate font-mono text-xs text-muted">{conn.endpoint || `AWS S3 · ${conn.region}`}</p>
      </div>
    </div>
  );
}

const EXPIRY = [
  { label: "1 jam", value: 3600 },
  { label: "1 hari", value: 86400 },
  { label: "7 hari", value: 604800 },
];

function ShareDialog({ connId, bucket, file, onClose }: { connId: number; bucket: string; file: FileEntry; onClose: () => void }) {
  const toast = useToast();
  const [expires, setExpires] = useState(3600);
  const [link, setLink] = useState<{ expires: number; url: string } | null>(null);
  const url = link?.expires === expires ? link.url : "";

  useEffect(() => {
    api<{ url: string }>(`/api/s3/${connId}/url?${qs({ bucket, key: file.key, expires })}`)
      .then((r) => setLink({ expires, url: r.url }))
      .catch((e) => toast("error", (e as Error).message));
  }, [connId, bucket, file.key, expires, toast]);

  return (
    <Modal open onClose={onClose} title={`Bagikan — ${file.name}`}>
      <div className="space-y-4">
        <div>
          <span className="mb-1.5 block text-[13px] font-medium">Berlaku selama</span>
          <div className="flex gap-1.5">
            {EXPIRY.map((x) => (
              <button
                key={x.value}
                onClick={() => setExpires(x.value)}
                className={`rounded-full border px-3 py-1 text-[13px] ${
                  expires === x.value ? "border-accent bg-accent-soft font-medium text-accent" : "border-line text-muted hover:text-fg"
                }`}
              >
                {x.label}
              </button>
            ))}
          </div>
        </div>
        <Field label="Link presigned" hint="Siapa pun yang punya link ini bisa mengunduh file sampai masa berlakunya habis.">
          <div className="flex gap-2">
            <Input readOnly value={url} placeholder="Membuat link…" className="font-mono text-xs" onFocus={(e) => e.target.select()} />
            <Button variant="primary" disabled={!url} onClick={() => copyText(url, toast)}>
              <Copy className="size-4" /> Salin
            </Button>
          </div>
        </Field>
      </div>
    </Modal>
  );
}

type HeadInfo = {
  size: number;
  contentType: string | null;
  lastModified: string | null;
  etag: string | null;
  storageClass: string;
  metadata: Record<string, string>;
};

function InfoDialog({ connId, bucket, file, onClose }: { connId: number; bucket: string; file: FileEntry; onClose: () => void }) {
  const [info, setInfo] = useState<HeadInfo | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<HeadInfo>(`/api/s3/${connId}/head?${qs({ bucket, key: file.key })}`)
      .then(setInfo)
      .catch((e) => setError((e as Error).message));
  }, [connId, bucket, file.key]);

  const rows: [string, React.ReactNode][] = info
    ? [
        ["Key", <span key="k" className="font-mono text-xs break-all">{file.key}</span>],
        ["Ukuran", `${formatBytes(info.size)} (${info.size.toLocaleString("id-ID")} byte)`],
        ["Content-Type", info.contentType ?? "—"],
        ["Diubah", formatDate(info.lastModified)],
        ["ETag", <span key="e" className="font-mono text-xs break-all">{info.etag ?? "—"}</span>],
        ["Storage class", info.storageClass],
        ...Object.entries(info.metadata).map(([k, v]) => [`x-amz-meta-${k}`, v] as [string, string]),
      ]
    : [];

  return (
    <Modal open onClose={onClose} title={file.name}>
      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : !info ? (
        <Spinner className="mx-auto my-8" />
      ) : (
        <dl className="divide-y divide-line text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[130px_1fr] gap-3 py-2">
              <dt className="text-muted">{k}</dt>
              <dd className="min-w-0">{v}</dd>
            </div>
          ))}
        </dl>
      )}
    </Modal>
  );
}
