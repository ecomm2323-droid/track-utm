"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, authToken, passwordOk } from "@/lib/auth";
import { limited } from "@/lib/http";

export async function login(form: FormData) {
  const password = process.env.APP_PASSWORD;
  if (!password) redirect("/");
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  if (limited(`login|${ip}`, 10) || !passwordOk(String(form.get("password") ?? ""), password)) redirect("/login?error=1");
  (await cookies()).set(AUTH_COOKIE, authToken(password), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  redirect("/");
}
