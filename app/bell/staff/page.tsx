import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentStaff } from "@/lib/admin-session";
import { isBellStaff, waitingRings } from "@/lib/bell";
import { pushPublicKey } from "@/lib/push";
import BellStaff from "./BellStaff";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Salla — the bell",
  manifest: "/bell.webmanifest",
};

/**
 * The screen inside the shop.
 *
 * Signed in, because it carries customers' names and telephone numbers, and
 * only for the people the bell is meant for — an owner may always watch it,
 * so a ring is never left with nobody looking.
 */
export default async function BellStaffPage() {
  const staff = await currentStaff();
  if (!staff) redirect("/admin/login?next=/bell/staff");
  if (!isBellStaff(staff.name, staff.role)) redirect("/admin");

  return (
    <BellStaff
      me={staff.name}
      rings={await waitingRings()}
      pushKey={pushPublicKey()}
    />
  );
}
