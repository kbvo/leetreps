import { cookies } from "next/headers";
import { getToday } from "./scheduler";

const DEV_DATE_COOKIE = "dev-date";

/**
 * Returns today's date, substituting the dev-date cookie override when
 * running outside of production. Never affects production builds.
 */
export async function getEffectiveToday(): Promise<Date> {
  if (process.env.NODE_ENV === "production") return getToday();

  const store = await cookies();
  const val = store.get(DEV_DATE_COOKIE)?.value;
  if (!val || !/^\d{4}-\d{2}-\d{2}$/.test(val)) return getToday();

  const [y, m, d] = val.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
