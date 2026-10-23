import { NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { clientFor, requireString, route } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

/** Presigned GET URL for preview, download or sharing. */
export const GET = route<Ctx>(async (req, { params }) => {
  const client = await clientFor(params);
  const sp = new URL(req.url).searchParams;
  const bucket = requireString(sp.get("bucket"), "bucket");
  const key = requireString(sp.get("key"), "key");
  const download = sp.get("download") === "1";
  const expiresIn = Math.min(Math.max(Number(sp.get("expires")) || 3600, 60), 604800);

  const filename = key.split("/").pop() || "download";
  const url = await getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentDisposition: download
        ? `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`
        : undefined,
    }),
    { expiresIn },
  );
  return NextResponse.json({ url, expiresIn });
});
