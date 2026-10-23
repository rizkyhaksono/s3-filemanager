"use client";

export async function api<T = unknown>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(url, {
    ...rest,
    headers: json !== undefined ? { "content-type": "application/json", ...rest.headers } : rest.headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    // Full reload so the server layout re-checks the session.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/login");
  }
  if (!res.ok) throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
  return data as T;
}

export function qs(params: Record<string, string | number | undefined | null>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  return sp.toString();
}

/** Upload with progress via XHR (fetch has no upload progress events). */
export function uploadFile(
  connId: number,
  bucket: string,
  key: string,
  file: File,
  onProgress: (loaded: number) => void,
): { promise: Promise<void>; abort: () => void } {
  const xhr = new XMLHttpRequest();
  const promise = new Promise<void>((resolve, reject) => {
    xhr.open("PUT", `/api/s3/${connId}/upload?${qs({ bucket, key })}`);
    xhr.setRequestHeader("content-type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let msg = `HTTP ${xhr.status}`;
      try {
        msg = JSON.parse(xhr.responseText).error || msg;
      } catch {}
      reject(new Error(msg));
    };
    xhr.onerror = () => reject(new Error("Koneksi terputus"));
    xhr.onabort = () => reject(new Error("Dibatalkan"));
    xhr.send(file);
  });
  return { promise, abort: () => xhr.abort() };
}

export function formatBytes(n: number) {
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export type FileKind = "image" | "video" | "audio" | "pdf" | "text" | "archive" | "code" | "other";

const EXT: Record<string, FileKind> = {};
const add = (kind: FileKind, list: string) => list.split(" ").forEach((e) => (EXT[e] = kind));
add("image", "png jpg jpeg gif webp svg bmp ico avif");
add("video", "mp4 webm mov mkv ogv m4v");
add("audio", "mp3 wav ogg m4a flac aac opus");
add("pdf", "pdf");
add("text", "txt md csv log ini conf env yml yaml toml xml");
add("code", "js jsx ts tsx json html css scss py go rs php java c cpp h sh rb sql vue svelte");
add("archive", "zip rar 7z tar gz tgz bz2 xz");

export function fileKind(name: string): FileKind {
  const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
  return EXT[ext] ?? "other";
}

export function isPreviewable(name: string) {
  return fileKind(name) !== "archive" && fileKind(name) !== "other";
}
