import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, isAuthorized, isConfigured, makeSession, passwordMatches } from "@/lib/session";

export async function GET(request: NextRequest) {
  return NextResponse.json({ configured: isConfigured(), authenticated: isAuthorized(request) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!isConfigured()) return NextResponse.json({ error: "Configurazione mancante: controlla le variabili d'ambiente." }, { status: 503 });
  let password = "";
  try {
    const json = await request.json();
    password = typeof json.password === "string" ? json.password : "";
  } catch {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }
  if (!passwordMatches(password)) return NextResponse.json({ error: "Password non corretta." }, { status: 401 });
  const session = makeSession();
  const response = NextResponse.json({ authenticated: true });
  response.cookies.set(COOKIE_NAME, session.value, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: session.maxAge });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
  return response;
}
