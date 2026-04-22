import { cookies } from "next/headers";
import { DevTimeControls } from "./dev-time-controls";

export async function DevTimeBar() {
  if (process.env.NODE_ENV === "production") return null;

  const store = await cookies();
  const currentDevDate = store.get("dev-date")?.value ?? null;

  return <DevTimeControls currentDevDate={currentDevDate} />;
}
