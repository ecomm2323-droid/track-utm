"use server";

import { revalidatePath } from "next/cache";
import { syncAll } from "./meta";

export async function syncMetaAction() {
  await syncAll();
  revalidatePath("/");
  revalidatePath("/campanas");
  revalidatePath("/ventas");
}
