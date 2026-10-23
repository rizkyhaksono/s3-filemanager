import { NextResponse } from "next/server";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { clientFor, requireString, route } from "@/lib/api";
import type { Entry, ListResult } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

/** List one "directory" level of a bucket using the "/" delimiter. */
export const GET = route<Ctx>(async (req, { params }) => {
  const client = await clientFor(params);
  const sp = new URL(req.url).searchParams;
  const bucket = requireString(sp.get("bucket"), "bucket");
  const prefix = sp.get("prefix") ?? "";
  const token = sp.get("token") || undefined;

  const res = await client.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      Delimiter: "/",
      ContinuationToken: token,
      MaxKeys: 1000,
    }),
  );

  const entries: Entry[] = [];
  for (const p of res.CommonPrefixes ?? []) {
    if (!p.Prefix) continue;
    entries.push({
      type: "folder",
      key: p.Prefix,
      name: p.Prefix.slice(prefix.length).replace(/\/$/, ""),
    });
  }
  for (const o of res.Contents ?? []) {
    // Skip the zero-byte placeholder that represents the current folder itself.
    if (!o.Key || o.Key === prefix) continue;
    entries.push({
      type: "file",
      key: o.Key,
      name: o.Key.slice(prefix.length),
      size: o.Size ?? 0,
      lastModified: o.LastModified?.toISOString() ?? null,
      storageClass: o.StorageClass ?? null,
    });
  }

  const result: ListResult = {
    entries,
    nextToken: res.IsTruncated ? (res.NextContinuationToken ?? null) : null,
  };
  return NextResponse.json(result);
});
