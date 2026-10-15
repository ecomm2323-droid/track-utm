import { createHmac, timingSafeEqual } from "node:crypto";

export const AUTH_COOKIE = "ut_auth";

// shortcut: one shared password from APP_PASSWORD, no users. The cookie holds an HMAC of it (never the password
// itself) so changing the password logs everyone out. Replace with real accounts (Auth.js) before selling.
export const authToken = (password: string) => createHmac("sha256", password).update("ut-auth-v1").digest("hex");

const digest = (s: string) => createHmac("sha256", "cmp").update(s).digest();
export const passwordOk = (input: string, password: string) => timingSafeEqual(digest(input), digest(password));
