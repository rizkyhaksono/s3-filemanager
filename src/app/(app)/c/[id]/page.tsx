import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getConnectionRow, toPublic } from "@/lib/connections";
import { FileManager } from "@/components/FileManager";
import { Spinner } from "@/components/ui";

export default async function ConnectionPage({ params }: { params: Promise<{ id: string }> }) {
  const row = getConnectionRow(Number((await params).id));
  if (!row) notFound();
  return (
    <Suspense fallback={<Spinner className="mx-auto mt-20" />}>
      <FileManager conn={toPublic(row)} />
    </Suspense>
  );
}
