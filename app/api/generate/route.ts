import { NextRequest, NextResponse } from "next/server";
import { isAuthorized, isConfigured } from "@/lib/session";
import { buildPrompt } from "@/lib/prompts";
import { SHOTS, CATEGORIES, type Category, type ShotId } from "@/lib/shots";

export const runtime = "nodejs";
export const maxDuration = 180;
export const dynamic = "force-dynamic";

function validImage(value: unknown): value is string {
  return typeof value === "string" && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value) && value.length < 8_000_000;
}

export async function POST(request: NextRequest) {
  if (!isConfigured()) return NextResponse.json({ error: "Server non configurato." }, { status: 503 });
  if (!isAuthorized(request)) return NextResponse.json({ error: "Sessione scaduta. Accedi di nuovo." }, { status: 401 });
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 12_000_000) return NextResponse.json({ error: "Foto troppo pesante. Riduci la risoluzione." }, { status: 413 });
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }
  const image = body.image;
  const reference = body.reference;
  const slot = body.slot;
  const category = body.category;
  if (!validImage(image) || (reference != null && !validImage(reference))) {
    return NextResponse.json({ error: "Carica immagini valide." }, { status: 400 });
  }
  if (!SHOTS.some((shot) => shot.id === slot) || !CATEGORIES.some((item) => item.value === category)) {
    return NextResponse.json({ error: "Tipo di scatto o categoria non validi." }, { status: 400 });
  }
  const prompt = buildPrompt(slot as ShotId, category as Category, typeof body.notes === "string" ? body.notes : "");
  const apiPayload = {
    model: "gpt-image-2.5-sunburst",
    images: [{ image_url: image }, ...(reference ? [{ image_url: reference }] : [])],
    prompt,
    size: "1024x1024",
    quality: "high",
    output_format: "png",
    background: "opaque",
    n: 1
  };
  try {
    const upstream = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: "Bearer " + process.env.OPENAI_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(apiPayload),
      signal: AbortSignal.timeout(165000),
      cache: "no-store"
    });
    if (!upstream.ok) {
      const payload = await upstream.json().catch(() => null);
      const message = typeof payload?.error?.message === "string" ? payload.error.message : "Errore durante la generazione.";
      return NextResponse.json({ error: message.slice(0, 400) }, { status: upstream.status >= 500 ? 502 : upstream.status });
    }
    const result = await upstream.json();
    const base64 = result?.data?.[0]?.b64_json;
    if (typeof base64 !== "string" || !base64) throw new Error("Il servizio non ha restituito una fotografia.");
    return NextResponse.json({ image: "data:image/png;base64," + base64 }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generazione non riuscita.";
    return NextResponse.json({ error: message.includes("timeout") ? "Tempo massimo superato. Riprova questo scatto." : message }, { status: 502 });
  }
}
