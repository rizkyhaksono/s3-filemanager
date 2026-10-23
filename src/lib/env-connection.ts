import "server-only";
import { ENV_CONNECTION_ID, type Connection } from "./types";

function str(name: string) {
  const v = process.env[name];
  return typeof v === "string" ? v.trim() : "";
}

function endpointFromEnv(): string | null {
  let endpoint = str("S3_ENDPOINT");
  if (!endpoint) return null;
  if (!/^https?:\/\//i.test(endpoint)) endpoint = `https://${endpoint}`;
  return endpoint.replace(/\/+$/, "");
}

/** Path-style is the usual requirement for S3-compatible providers. */
function forcePathStyle() {
  const v = str("S3_FORCE_PATH_STYLE").toLowerCase();
  return v !== "false" && v !== "0";
}

/** Public view of the env connection. Null when access key or secret is missing. */
export function envPublicConnection(): Connection | null {
  const accessKeyId = str("S3_ACCESS_KEY_ID");
  if (!accessKeyId || !str("S3_SECRET_ACCESS_KEY")) return null;
  return {
    id: ENV_CONNECTION_ID,
    name: str("S3_NAME") || "S3",
    provider: "custom",
    endpoint: endpointFromEnv(),
    region: str("S3_REGION") || "us-east-1",
    accessKeyId,
    bucket: str("S3_BUCKET") || null,
    forcePathStyle: forcePathStyle(),
    createdAt: "",
    updatedAt: "",
  };
}

/** Credentials for the S3 client. Secret stays on the server. */
export function envConnectionConfig(): {
  endpoint: string | null;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
} | null {
  const pub = envPublicConnection();
  if (!pub) return null;
  return {
    endpoint: pub.endpoint,
    region: pub.region,
    accessKeyId: pub.accessKeyId,
    secretAccessKey: str("S3_SECRET_ACCESS_KEY"),
    forcePathStyle: pub.forcePathStyle,
  };
}
