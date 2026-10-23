import { NextResponse } from "next/server";
import { CreateBucketCommand, DeleteBucketCommand, ListBucketsCommand } from "@aws-sdk/client-s3";
import { clientFor, readJson, requireString, route } from "@/lib/api";
import type { BucketInfo } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (_req, { params }) => {
  const client = await clientFor(params);
  const res = await client.send(new ListBucketsCommand({}));
  const buckets: BucketInfo[] = (res.Buckets ?? []).map((b) => ({
    name: b.Name ?? "",
    createdAt: b.CreationDate?.toISOString() ?? null,
  }));
  return NextResponse.json(buckets);
});

export const POST = route<Ctx>(async (req, { params }) => {
  const client = await clientFor(params);
  const name = requireString((await readJson(req)).name, "name").trim();
  await client.send(new CreateBucketCommand({ Bucket: name }));
  return NextResponse.json({ ok: true }, { status: 201 });
});

export const DELETE = route<Ctx>(async (req, { params }) => {
  const client = await clientFor(params);
  const name = requireString(new URL(req.url).searchParams.get("bucket"), "bucket");
  await client.send(new DeleteBucketCommand({ Bucket: name }));
  return NextResponse.json({ ok: true });
});
