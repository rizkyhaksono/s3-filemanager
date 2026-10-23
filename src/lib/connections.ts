import "server-only";
import { db } from "./db";
import { envConnectionConfig, envPublicConnection } from "./env-connection";
import { decrypt, encrypt } from "./secret";
import { ENV_CONNECTION_ID, type Connection } from "./types";

export type ConnectionRow = {
  id: number;
  name: string;
  provider: string;
  endpoint: string | null;
  region: string;
  access_key_id: string;
  secret_access_key: string;
  bucket: string | null;
  force_path_style: number;
  created_at: string;
  updated_at: string;
};

/** Shape sent to the browser — never includes the secret key. */
export type PublicConnection = Connection;

export type ConnectionConfig = {
  endpoint: string | null;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
};

export type ConnectionInput = {
  name: string;
  provider: string;
  endpoint: string | null;
  region: string;
  accessKeyId: string;
  secretAccessKey?: string;
  bucket: string | null;
  forcePathStyle: boolean;
};

export class ValidationError extends Error {}

export function toPublic(r: ConnectionRow): PublicConnection {
  return {
    id: r.id,
    name: r.name,
    provider: r.provider,
    endpoint: r.endpoint,
    region: r.region,
    accessKeyId: r.access_key_id,
    bucket: r.bucket,
    forcePathStyle: !!r.force_path_style,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function listConnections(): PublicConnection[] {
  const rows = db
    .prepare("SELECT * FROM connections ORDER BY name COLLATE NOCASE")
    .all() as ConnectionRow[];
  return rows.map(toPublic);
}

export function getConnectionRow(id: number): ConnectionRow | undefined {
  if (id === ENV_CONNECTION_ID) {
    const pub = envPublicConnection();
    if (!pub) return undefined;
    return {
      id: pub.id,
      name: pub.name,
      provider: pub.provider,
      endpoint: pub.endpoint,
      region: pub.region,
      access_key_id: pub.accessKeyId,
      secret_access_key: "",
      bucket: pub.bucket,
      force_path_style: pub.forcePathStyle ? 1 : 0,
      created_at: pub.createdAt,
      updated_at: pub.updatedAt,
    };
  }
  return db.prepare("SELECT * FROM connections WHERE id = ?").get(id) as
    | ConnectionRow
    | undefined;
}

export function getConnectionConfig(id: number): ConnectionConfig | null {
  if (id === ENV_CONNECTION_ID) return envConnectionConfig();
  const row = getConnectionRow(id);
  if (!row) return null;
  return {
    endpoint: row.endpoint,
    region: row.region,
    accessKeyId: row.access_key_id,
    secretAccessKey: decrypt(row.secret_access_key),
    forcePathStyle: !!row.force_path_style,
  };
}

export function createConnection(input: ConnectionInput): PublicConnection {
  const info = db
    .prepare(
      `INSERT INTO connections
        (name, provider, endpoint, region, access_key_id, secret_access_key, bucket, force_path_style)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.name,
      input.provider,
      input.endpoint,
      input.region,
      input.accessKeyId,
      encrypt(input.secretAccessKey ?? ""),
      input.bucket,
      input.forcePathStyle ? 1 : 0,
    );
  return toPublic(getConnectionRow(Number(info.lastInsertRowid))!);
}

export function updateConnection(id: number, input: ConnectionInput): PublicConnection | null {
  const existing = getConnectionRow(id);
  if (!existing) return null;
  // An empty secret on edit means "keep the stored one".
  const secret = input.secretAccessKey
    ? encrypt(input.secretAccessKey)
    : existing.secret_access_key;
  db.prepare(
    `UPDATE connections SET
       name = ?, provider = ?, endpoint = ?, region = ?, access_key_id = ?,
       secret_access_key = ?, bucket = ?, force_path_style = ?, updated_at = datetime('now')
     WHERE id = ?`,
  ).run(
    input.name,
    input.provider,
    input.endpoint,
    input.region,
    input.accessKeyId,
    secret,
    input.bucket,
    input.forcePathStyle ? 1 : 0,
    id,
  );
  return toPublic(getConnectionRow(id)!);
}

export function deleteConnection(id: number) {
  return db.prepare("DELETE FROM connections WHERE id = ?").run(id).changes > 0;
}

/** Validate and normalise a JSON body from the connection form. */
export function parseConnectionInput(body: unknown, requireSecret: boolean): ConnectionInput {
  const b = (body ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const name = str(b.name);
  const accessKeyId = str(b.accessKeyId);
  const secretAccessKey = str(b.secretAccessKey);
  let endpoint = str(b.endpoint) || null;
  if (endpoint && !/^https?:\/\//i.test(endpoint)) endpoint = `https://${endpoint}`;
  if (endpoint) endpoint = endpoint.replace(/\/+$/, "");

  if (!name) throw new ValidationError("Nama koneksi wajib diisi");
  if (!accessKeyId) throw new ValidationError("Access Key ID wajib diisi");
  if (requireSecret && !secretAccessKey) throw new ValidationError("Secret Access Key wajib diisi");
  if (endpoint) {
    try {
      new URL(endpoint);
    } catch {
      throw new ValidationError("Endpoint bukan URL yang valid");
    }
  }

  return {
    name,
    provider: str(b.provider) || "custom",
    endpoint,
    region: str(b.region) || "us-east-1",
    accessKeyId,
    secretAccessKey: secretAccessKey || undefined,
    bucket: str(b.bucket) || null,
    forcePathStyle: Boolean(b.forcePathStyle),
  };
}
