import "server-only";
import { NextResponse } from "next/server";
import type { S3Client } from "@aws-sdk/client-s3";
import { isAuthenticated } from "./auth";
import { getConnectionConfig, ValidationError } from "./connections";
import { createClient, s3ErrorMessage } from "./s3";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/** Wrap a route handler with auth + uniform JSON error handling. */
export function route<C>(fn: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      if (!(await isAuthenticated())) throw new HttpError(401, "Belum login");
      return await fn(req, ctx);
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      if (err instanceof ValidationError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      console.error(err);
      return NextResponse.json({ error: s3ErrorMessage(err) }, { status: 502 });
    }
  };
}

export async function clientFor(params: Promise<{ id: string }>): Promise<S3Client> {
  const { id } = await params;
  const cfg = getConnectionConfig(Number(id));
  if (!cfg) throw new HttpError(404, "Koneksi tidak ditemukan");
  return createClient(cfg);
}

export function requireString(v: unknown, field: string): string {
  if (typeof v !== "string" || !v) throw new HttpError(400, `Parameter "${field}" wajib diisi`);
  return v;
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    return (await req.json()) ?? {};
  } catch {
    throw new HttpError(400, "Body JSON tidak valid");
  }
}
