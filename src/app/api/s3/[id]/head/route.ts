import { NextResponse } from "next/server";
import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { clientFor, requireString, route } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (req, { params }) => {
  const client = await clientFor(params);
  const sp = new URL(req.url).searchParams;
  const bucket = requireString(sp.get("bucket"), "bucket");
  const key = requireString(sp.get("key"), "key");

  const res = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  return NextResponse.json({
    key,
    size: res.ContentLength ?? 0,
    contentType: res.ContentType ?? null,
    lastModified: res.LastModified?.toISOString() ?? null,
    etag: res.ETag?.replace(/"/g, "") ?? null,
    storageClass: res.StorageClass ?? "STANDARD",
    metadata: res.Metadata ?? {},
  });
});
