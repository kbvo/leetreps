"use server";

import { cookies } from "next/headers";

const DEV_DATE_COOKIE = "dev-date";

export async function setDevDate(dateStr: string | null) {
  if (process.env.NODE_ENV === "production") return;

  const store = await cookies();
  if (!dateStr) {
    store.delete(DEV_DATE_COOKIE);
  } else {
    store.set(DEV_DATE_COOKIE, dateStr, {
      path: "/",
      httpOnly: false, // readable by client for display
      sameSite: "lax",
    });
  }
}
