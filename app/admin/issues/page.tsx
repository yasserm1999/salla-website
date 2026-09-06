import { redirect } from "next/navigation";
import { currentStaff } from "@/lib/admin-session";
import { loadIssues } from "@/lib/issues";
import { loadDay, shopToday } from "@/lib/pickups";
import { Issues } from "./Issues";

export const dynamic = "force-dynamic";
export const metadata = { title: "Salla — issues" };

/**
 * What is wrong, and what could be better.
 *
 * Anybody who works here can raise one; only the owners decide what happens
 * next. A worker sees what he reported and nothing else — the shop's whole
 * complaint book is not his to read, and a page that showed it would make
 * people think twice before adding to it.
 */
export default async function IssuesPage() {
  const staff = await currentStaff();
  if (!staff) redirect("/admin/login");

  const owner = staff.role === "owner";
  const [store, book] = await Promise.all([
    loadIssues(owner ? undefined : staff.name),
    // The customer book, for naming who a complaint is about.
    loadDay(shopToday()),
  ]);

  return (
    <Issues
      issues={store.issues}
      people={book.data.people.map((p) => ({
        id: p.id,
        name: p.name,
        phone: p.phone,
        cleanCloudId: p.cleanCloudId,
      }))}
      staff={staff.name}
      role={staff.role}
      ready={store.ready}
      problem={store.ready ? null : store.reason}
    />
  );
}
