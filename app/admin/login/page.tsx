import { redirect } from "next/navigation";
import { currentAdmin, isConfigured } from "@/lib/admin-session";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Salla — shop dashboard" };

export default async function AdminLogin() {
  if (await currentAdmin()) redirect("/admin");

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-2xl font-bold text-[#26364d]">Salla Laundry</h1>
        <p className="mb-6 mt-1 text-center text-sm text-[#8a9099]">Shop dashboard</p>
        {isConfigured() ? (
          <LoginForm />
        ) : (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            No login has been set up. Add ADMIN_USERS to the environment as
            name:password:role, then reload.
          </p>
        )}
      </div>
    </main>
  );
}
