import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { HardDrive } from "lucide-react";
import { authEnabled, isAuthenticated } from "@/lib/auth";
import { LogoutButton } from "@/components/LogoutButton";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await connection(); // always render per request (reads SQLite)
  if (!(await isAuthenticated())) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur">
        <div className="mx-auto flex h-13 max-w-[1400px] items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="grid size-7 place-items-center rounded-md bg-accent text-white">
              <HardDrive className="size-4" />
            </span>
            <span>S3 File Manager</span>
          </Link>
          {authEnabled() && <LogoutButton />}
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col px-4 py-6 sm:px-6">
        {children}
      </main>
    </div>
  );
}
