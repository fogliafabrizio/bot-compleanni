import type { Deps } from "../deps";
import { log } from "../log";
import type { Update } from "../telegram/types";
import { T } from "../texts";
import { route } from "./router";

// Route HTTP del Worker (contracts/webhook.md).
export async function handleRequest(request: Request, deps: Deps, webhookSecret: string): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname !== "/webhook") return new Response(null, { status: 404 });
  if (request.method !== "POST") return new Response(null, { status: 405 });
  // RNF-03: il token si verifica prima di leggere il body.
  if (!isValidSecret(request.headers.get("X-Telegram-Bot-Api-Secret-Token"), webhookSecret)) {
    return new Response(null, { status: 401 });
  }

  let update: Update;
  try {
    update = (await request.json()) as Update;
  } catch {
    return new Response(null, { status: 400 });
  }

  try {
    await route(update, deps);
  } catch (err) {
    log("handler_error", typeof (err as { errorCode?: unknown }).errorCode === "number"
      ? { error_code: (err as { errorCode: number }).errorCode }
      : undefined);
    await notifyOwnerOfError(update, deps);
  }
  // Sempre 200: Telegram non deve ritrasmettere un update già (anche in parte) gestito.
  return new Response(null, { status: 200 });
}

// Confronto a tempo costante dopo il controllo di lunghezza (research R-03).
function isValidSecret(header: string | null, secret: string): boolean {
  if (header === null || secret.length === 0) return false;
  const enc = new TextEncoder();
  const a = enc.encode(header);
  const b = enc.encode(secret);
  if (a.byteLength !== b.byteLength) return false;
  return crypto.subtle.timingSafeEqual(a, b);
}

// Solo il proprietario in chat privata riceve l'avviso; per chiunque altro, silenzio.
async function notifyOwnerOfError(update: Update, deps: Deps): Promise<void> {
  const msg = update.message ?? update.callback_query?.message;
  const from = update.message?.from ?? update.callback_query?.from;
  if (!msg || !from || String(from.id) !== deps.ownerId || msg.chat.type !== "private") return;
  try {
    await deps.tg.sendMessage(msg.chat.id, T.genericError);
  } catch {
    log("error_notify_failed");
  }
}
