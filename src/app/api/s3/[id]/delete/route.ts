import { NextResponse } from "next/server";
import { clientFor, readJson, requireString, route } from "@/lib/api";
import { deleteKeys, listAllUnderPrefix } from "@/lib/s3";

type Ctx = { params: Promise<{ id: string }> };

/** Delete files by key and folders recursively by prefix. */
export const POST = route<Ctx>(async (req, { params }) => {
  const client = await clientFor(params);
  const body = await readJson(req);
  const bucket = requireString(body.bucket, "bucket");
  const keys = Array.isArray(body.keys) ? body.keys.filter((k) => typeof k === "string") : [];
  const prefixes = Array.isArray(body.prefixes)
    ? body.prefixes.filter((p): p is string => typeof p === "string" && p.endsWith("/"))
    : [];

  const all = new Set<string>(keys);
  for (const prefix of prefixes) {
    all.add(prefix);
    for (const o of await listAllUnderPrefix(client, bucket, prefix)) {
      if (o.Key) all.add(o.Key);
    }
  }

  const deleted = await deleteKeys(client, bucket, [...all]);
  return NextResponse.json({ ok: true, deleted });
});
