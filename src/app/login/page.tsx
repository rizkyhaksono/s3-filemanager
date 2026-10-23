import { redirect } from "next/navigation";
import { connection } from "next/server";
import { authEnabled, isAuthenticated } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  await connection();
  if (!authEnabled() || (await isAuthenticated())) redirect("/");
  return <LoginForm />;
}
