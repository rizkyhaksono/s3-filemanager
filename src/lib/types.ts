// Types and constants shared between the server routes and the browser.

export type Connection = {
  id: number;
  name: string;
  provider: string;
  endpoint: string | null;
  region: string;
  accessKeyId: string;
  bucket: string | null;
  forcePathStyle: boolean;
  createdAt: string;
  updatedAt: string;
};

export type BucketInfo = { name: string; createdAt: string | null };

export type FolderEntry = { type: "folder"; key: string; name: string };
export type FileEntry = {
  type: "file";
  key: string;
  name: string;
  size: number;
  lastModified: string | null;
  storageClass: string | null;
};
export type Entry = FolderEntry | FileEntry;

export type ListResult = {
  entries: Entry[];
  nextToken: string | null;
};

export type ProviderPreset = {
  id: string;
  label: string;
  endpoint: string;
  region: string;
  forcePathStyle: boolean;
  hint?: string;
};

export const PROVIDERS: ProviderPreset[] = [
  { id: "aws", label: "Amazon S3", endpoint: "", region: "us-east-1", forcePathStyle: false,
    hint: "Kosongkan endpoint untuk AWS. Isi region sesuai bucket." },
  { id: "r2", label: "Cloudflare R2", endpoint: "https://<ACCOUNT_ID>.r2.cloudflarestorage.com",
    region: "auto", forcePathStyle: true, hint: "Ganti <ACCOUNT_ID> dengan Account ID Cloudflare." },
  { id: "minio", label: "MinIO", endpoint: "http://localhost:9000", region: "us-east-1",
    forcePathStyle: true },
  { id: "spaces", label: "DigitalOcean Spaces", endpoint: "https://sgp1.digitaloceanspaces.com",
    region: "sgp1", forcePathStyle: false },
  { id: "wasabi", label: "Wasabi", endpoint: "https://s3.ap-southeast-1.wasabisys.com",
    region: "ap-southeast-1", forcePathStyle: false },
  { id: "b2", label: "Backblaze B2", endpoint: "https://s3.us-west-004.backblazeb2.com",
    region: "us-west-004", forcePathStyle: false },
  { id: "idcloudhost", label: "IDCloudHost", endpoint: "https://is3.cloudhost.id",
    region: "us-east-1", forcePathStyle: true },
  { id: "custom", label: "Lainnya (S3 compatible)", endpoint: "", region: "us-east-1",
    forcePathStyle: true },
];
