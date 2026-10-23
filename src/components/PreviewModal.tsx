"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { api, fileKind, formatBytes, qs } from "@/lib/client";
import type { FileEntry } from "@/lib/types";
import { Button, Modal, Spinner } from "./ui";

export function PreviewModal({
  connId,
  bucket,
  file,
  onClose,
  onNavigate,
  onDownload,
}: {
  connId: number;
  bucket: string;
  file: FileEntry | null;
  onClose: () => void;
  onNavigate: (dir: -1 | 1) => void;
  onDownload: (f: FileEntry) => void;
}) {
  useEffect(() => {
    if (!file) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") onNavigate(-1);
      if (e.key === "ArrowRight") onNavigate(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [file, onNavigate]);

  return (
    <Modal
      open={!!file}
      onClose={onClose}
      width="max-w-5xl"
      title={
        <span className="flex items-center gap-2">
          {file?.name}
          <span className="text-xs font-normal text-muted">{file && formatBytes(file.size)}</span>
        </span>
      }
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={() => onNavigate(-1)} title="Sebelumnya (←)">
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onNavigate(1)} title="Berikutnya (→)" className="mr-auto">
            <ChevronRight className="size-4" />
          </Button>
          <Button variant="primary" size="sm" onClick={() => file && onDownload(file)}>
            <Download className="size-4" /> Download
          </Button>
        </>
      }
    >
      {file && <PreviewBody key={file.key} connId={connId} bucket={bucket} file={file} />}
    </Modal>
  );
}

function PreviewBody({ connId, bucket, file }: { connId: number; bucket: string; file: FileEntry }) {
  const [url, setUrl] = useState<string | null>(null);
  const [text, setText] = useState<{ text: string; truncated: boolean } | null>(null);
  const [error, setError] = useState("");
  const kind = fileKind(file.name);

  useEffect(() => {
    let cancelled = false;
    const params = qs({ bucket, key: file.key });
    const req =
      kind === "text" || kind === "code"
        ? api<{ text: string; truncated: boolean }>(`/api/s3/${connId}/object?${params}`).then((r) => !cancelled && setText(r))
        : api<{ url: string }>(`/api/s3/${connId}/url?${params}`).then((r) => !cancelled && setUrl(r.url));
    req.catch((e) => !cancelled && setError((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, [file.key, bucket, connId, kind]);

  const loading = !error && !url && !text;

  return (
    <div className="grid min-h-[300px] place-items-center">
      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : loading ? (
        <Spinner />
      ) : kind === "image" && url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={file.name} className="max-h-[70vh] max-w-full rounded-md object-contain" />
      ) : kind === "video" && url ? (
        <video src={url} controls autoPlay className="max-h-[70vh] max-w-full rounded-md bg-black" />
      ) : kind === "audio" && url ? (
        <audio src={url} controls autoPlay className="w-full" />
      ) : kind === "pdf" && url ? (
        <iframe src={url} className="h-[70vh] w-full rounded-md border border-line" title={file.name} />
      ) : text ? (
        <div className="w-full">
          <pre className="max-h-[65vh] w-full overflow-auto rounded-md bg-subtle p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all">
            {text.text || <span className="text-muted">(file kosong)</span>}
          </pre>
          {text.truncated && <p className="mt-2 text-xs text-muted">Hanya 1 MB pertama yang ditampilkan.</p>}
        </div>
      ) : (
        <p className="text-sm text-muted">Pratinjau tidak tersedia untuk tipe file ini.</p>
      )}
    </div>
  );
}
