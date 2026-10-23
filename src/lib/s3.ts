import "server-only";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
  type _Object,
} from "@aws-sdk/client-s3";
import type { ConnectionConfig } from "./connections";

export function createClient(c: ConnectionConfig) {
  return new S3Client({
    region: c.region || "us-east-1",
    endpoint: c.endpoint || undefined,
    forcePathStyle: c.forcePathStyle,
    credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey },
    // Newer SDKs send CRC checksums by default, which many S3-compatible
    // providers reject. Only send them when an operation strictly needs one.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}

/** Encode an object key for the CopySource header, keeping slashes. */
export function copySource(bucket: string, key: string) {
  return `${bucket}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export async function listAllUnderPrefix(client: S3Client, bucket: string, prefix: string) {
  const out: _Object[] = [];
  let token: string | undefined;
  do {
    const res = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }),
    );
    out.push(...(res.Contents ?? []));
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return out;
}

export async function deleteKeys(client: S3Client, bucket: string, keys: string[]) {
  let deleted = 0;
  for (let i = 0; i < keys.length; i += 1000) {
    const chunk = keys.slice(i, i + 1000);
    try {
      const res = await client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: chunk.map((Key) => ({ Key })), Quiet: true },
        }),
      );
      if (res.Errors?.length) {
        throw new Error(res.Errors.map((e) => `${e.Key}: ${e.Message}`).join("; "));
      }
      deleted += chunk.length;
    } catch (err) {
      // Some providers don't support batch delete — fall back to one by one.
      if ((err as { name?: string }).name === "NotImplemented" || isChecksumError(err)) {
        for (const Key of chunk) {
          await client.send(new DeleteObjectCommand({ Bucket: bucket, Key }));
          deleted++;
        }
      } else {
        throw err;
      }
    }
  }
  return deleted;
}

function isChecksumError(err: unknown) {
  return /content-md5|checksum/i.test(String((err as Error)?.message ?? ""));
}

export async function copyObject(client: S3Client, bucket: string, from: string, to: string) {
  await client.send(
    new CopyObjectCommand({ Bucket: bucket, CopySource: copySource(bucket, from), Key: to }),
  );
}

/** Turn an SDK error into a readable message. */
export function s3ErrorMessage(err: unknown): string {
  const e = err as {
    name?: string;
    code?: string;
    message?: string;
    $metadata?: { httpStatusCode?: number };
  };
  const map: Record<string, string> = {
    InvalidAccessKeyId: "Access Key ID tidak valid",
    SignatureDoesNotMatch: "Secret Access Key salah (signature tidak cocok)",
    AccessDenied: "Akses ditolak — periksa permission key ini",
    NoSuchBucket: "Bucket tidak ditemukan",
    NoSuchKey: "File tidak ditemukan",
    BucketNotEmpty: "Bucket tidak kosong",
    BucketAlreadyExists: "Nama bucket sudah dipakai",
    BucketAlreadyOwnedByYou: "Bucket sudah ada di akun ini",
    ENOTFOUND: "Endpoint tidak dapat dijangkau (DNS gagal)",
    ECONNREFUSED: "Koneksi ke endpoint ditolak",
  };
  const friendly = (e.name && map[e.name]) || (e.code && map[e.code]);
  if (friendly) return friendly;
  const status = e.$metadata?.httpStatusCode;
  const name = e.name && e.name !== "Error" ? e.name : "";
  return (
    [name, e.message, status ? `(HTTP ${status})` : ""].filter(Boolean).join(" ").trim() ||
    "Terjadi kesalahan pada S3"
  );
}
