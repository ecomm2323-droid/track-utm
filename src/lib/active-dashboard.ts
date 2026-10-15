import { cookies } from "next/headers";
import { getProject } from "./db";
import { dashboards, type Dashboard } from "./dashboards";

export const DASH_COOKIE = "ut_dash";

// Dashboard chosen in the switcher (cookie), falling back to the first one.
export async function activeDashboard(): Promise<Dashboard | undefined> {
  const list = dashboards(getProject().id);
  const id = Number((await cookies()).get(DASH_COOKIE)?.value);
  return list.find((d) => d.id === id) ?? list[0];
}
