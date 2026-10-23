import { NextResponse } from "next/server";
import { HttpError, readJson, route } from "@/lib/api";
import {
  deleteConnection,
  getConnectionRow,
  parseConnectionInput,
  toPublic,
  updateConnection,
} from "@/lib/connections";
import { ENV_CONNECTION_ID } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (_req, { params }) => {
  const row = getConnectionRow(Number((await params).id));
  if (!row) throw new HttpError(404, "Koneksi tidak ditemukan");
  return NextResponse.json(toPublic(row));
});

export const PUT = route<Ctx>(async (req, { params }) => {
  if (Number((await params).id) === ENV_CONNECTION_ID) {
    throw new HttpError(400, "Koneksi dari environment tidak bisa diubah");
  }
  const input = parseConnectionInput(await readJson(req), false);
  const updated = updateConnection(Number((await params).id), input);
  if (!updated) throw new HttpError(404, "Koneksi tidak ditemukan");
  return NextResponse.json(updated);
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  if (Number((await params).id) === ENV_CONNECTION_ID) {
    throw new HttpError(400, "Koneksi dari environment tidak bisa dihapus");
  }
  if (!deleteConnection(Number((await params).id))) {
    throw new HttpError(404, "Koneksi tidak ditemukan");
  }
  return NextResponse.json({ ok: true });
});
