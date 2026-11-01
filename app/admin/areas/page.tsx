import { redirect } from "next/navigation";
import { currentStaff } from "@/lib/admin-session";
import { listPeople, loadAreas } from "@/lib/pickups";
import { AreaProvider } from "../AreaTag";
import { Areas } from "./Areas";

export const dynamic = "force-dynamic";
export const metadata = { title: "Salla — areas" };

/**
 * Every customer and the area they live in, to be filled in all at once.
 *
 * The badge on each delivery sets an area too, but only as customers happen
 * to come up. This is for sitting down with the book and doing the lot.
 * Open to whoever plans the round: the owners and the driver.
 */
export default async function AreasPage() {
  const staff = await currentStaff();
  if (!staff) redirect("/admin/login");
  if (staff.role !== "owner" && staff.role !== "driver") redirect("/admin");

  const [people, areas] = await Promise.all([listPeople(), loadAreas()]);

  return (
    <AreaProvider book={areas} canEdit>
      <Areas
        people={people.map((p) => ({
          id: p.id,
          name: p.name,
          phone: p.phone,
          address: p.address,
          cleanCloudId: p.cleanCloudId,
        }))}
        back={staff.role === "owner" ? "Dashboard" : "Deliveries"}
        ready={areas.ready}
      />
    </AreaProvider>
  );
}
