import { redirect } from "next/navigation";
import { connection } from "next/server";
import { listConnections } from "@/lib/connections";
import { envPublicConnection } from "@/lib/env-connection";
import { ConnectionsView } from "@/components/ConnectionsView";

export default async function HomePage() {
  await connection();
  if (envPublicConnection()) redirect("/c/0");
  return <ConnectionsView initial={listConnections()} />;
}
