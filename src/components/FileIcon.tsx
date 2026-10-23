import {
  File,
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  FileText,
  FileVideo,
  Folder,
} from "lucide-react";
import { fileKind, type FileKind } from "@/lib/client";

const icons: Record<FileKind, [typeof File, string]> = {
  image: [FileImage, "text-violet-500"],
  video: [FileVideo, "text-pink-500"],
  audio: [FileAudio, "text-cyan-500"],
  pdf: [FileText, "text-red-500"],
  text: [FileText, "text-slate-500"],
  code: [FileCode, "text-emerald-500"],
  archive: [FileArchive, "text-amber-600"],
  other: [File, "text-faint"],
};

export function FileIcon({ name, folder, className = "size-[18px]" }: { name: string; folder?: boolean; className?: string }) {
  if (folder) return <Folder className={`${className} fill-accent/15 text-accent`} />;
  const [Icon, color] = icons[fileKind(name)];
  return <Icon className={`${className} ${color}`} />;
}
