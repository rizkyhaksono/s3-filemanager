import { listConnections } from "@/lib/connections";
import { ConnectionsView } from "@/components/ConnectionsView";

export default function HomePage() {
  return <ConnectionsView initial={listConnections()} />;
}
