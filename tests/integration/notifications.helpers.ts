import { runMaintenanceTick } from "@/modules/maintenance/tick";

export async function maintenanceTickForTest() {
  return runMaintenanceTick();
}
