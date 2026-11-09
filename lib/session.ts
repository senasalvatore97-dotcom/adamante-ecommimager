import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

export const COOKIE_NAME = "adamante_studio";
const WEEK_SECONDS = 7 * 24 * 60 * 60;

export function isConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY && process.env.STUDIO_PASSWORD && (process.env.SESSION_SECRET ?? "").length >= 32);
}

function sign(expires: string): string {
  return createHmac("sha256", process.env.SESSION_SECRET ?? "").update("adamante:" + expires).digest("hex");
}

export function makeSession(): { value: string; maxAge: number } {
  const expires = String(Math.floor(Date.now() / 1000) + WEEK_SECONDS);
  return { value: expires + "." + sign(expires), maxAge: WEEK_SECONDS };
}

export function isAuthorized(request: NextRequest): boolean {
  if (!isConfigured()) return false;
  const cookie = request.cookies.get(COOKIE_NAME)?.value;
  if (!cookie) return false;
  const parts = cookie.split(".");
  if (parts.length !== 2 || !/^\d+$/.test(parts[0]) || !/^[0-9a-f]{64}$/.test(parts[1])) return false;
  if (Number(parts[0]) < Math.floor(Date.now() / 1000)) return false;
  return timingSafeEqual(Buffer.from(parts[1], "hex"), Buffer.from(sign(parts[0]), "hex"));
}

export function passwordMatches(value: string): boolean {
  const correct = process.env.STUDIO_PASSWORD ?? "";
  const actualHash = createHash("sha256").update(value).digest();
  const expectedHash = createHash("sha256").update(correct).digest();
  return timingSafeEqual(actualHash, expectedHash);
}
