import { NextResponse } from "next/server";
import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { clientFor, HttpError, readJson, requireString, route } from "@/lib/api";
import { copyObject, deleteKeys, listAllUnderPrefix } from "@/lib/s3";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Rename / move a file or folder. S3 has no rename, so this copies every
 * object to its new key and then deletes the originals.
 */
export const POST = route<Ctx>(async (req, { params }) => {
  const client = await clientFor(params);
  const body = await readJson(req);
  const bucket = requireString(body.bucket, "bucket");
  const from = requireString(body.from, "from");
  const to = requireString(body.to, "to").replace(/^\/+/, "");
  if (from === to) return NextResponse.json({ ok: true, moved: 0 });

  const isFolder = from.endsWith("/");
  if (isFolder !== to.endsWith("/")) throw new HttpError(400, "Tujuan tidak valid");
  if (isFolder && to.startsWith(from)) {
    throw new HttpError(400, "Tidak bisa memindahkan folder ke dalam dirinya sendiri");
  }

  if (!isFolder) {
    const exists = await client
      .send(new HeadObjectCommand({ Bucket: bucket, Key: to }))
      .then(() => true)
      .catch(() => false);
    if (exists) throw new HttpError(409, "File dengan nama tersebut sudah ada");
    await copyObject(client, bucket, from, to);
    await deleteKeys(client, bucket, [from]);
    return NextResponse.json({ ok: true, moved: 1 });
  }

  const objects = await listAllUnderPrefix(client, bucket, from);
  const keys = objects.map((o) => o.Key!).filter(Boolean);
  if (!keys.includes(from)) keys.push(from); // folder placeholder may not exist
  const copied: string[] = [];
  for (const key of keys) {
    try {
      await copyObject(client, bucket, key, to + key.slice(from.length));
      copied.push(key);
    } catch (err) {
      // A missing placeholder is fine; anything else aborts before deleting.
      if (key === from && (err as { name?: string }).name === "NoSuchKey") continue;
      throw err;
    }
  }
  await deleteKeys(client, bucket, copied);
  return NextResponse.json({ ok: true, moved: copied.length });
});
