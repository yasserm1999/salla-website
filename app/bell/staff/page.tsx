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
  /*
    Safari ignores the manifest for this and reads its own meta tags. Without
    them an iPad opens the home-screen copy in a plain browser tab, and a tab
    is never allowed to raise an alert.
  */
  appleWebApp: { capable: true, title: "Salla bell", statusBarStyle: "black-translucent" },
  icons: { apple: "/logo.png" },
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
