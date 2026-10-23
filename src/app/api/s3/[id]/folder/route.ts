import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { clientFor, HttpError, readJson, requireString, route } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

/** S3 has no real folders — create a zero-byte "name/" placeholder object. */
export const POST = route<Ctx>(async (req, { params }) => {
  const client = await clientFor(params);
  const body = await readJson(req);
  const bucket = requireString(body.bucket, "bucket");
  const prefix = typeof body.prefix === "string" ? body.prefix : "";
  const name = requireString(body.name, "name").trim().replace(/^\/+|\/+$/g, "");
  if (!name) throw new HttpError(400, "Nama folder tidak valid");

  await client.send(
    new PutObjectCommand({ Bucket: bucket, Key: `${prefix}${name}/`, Body: "" }),
  );
  return NextResponse.json({ ok: true }, { status: 201 });
});
