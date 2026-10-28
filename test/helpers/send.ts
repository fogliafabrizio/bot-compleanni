import { handleRequest } from "../../src/bot/webhook";
import type { Update } from "../../src/telegram/types";
import { OWNER_ID, SECRET } from "./constants";
import type { TestDeps } from "./deps";
import { callbackUpdate, documentUpdate, textUpdate, webhookRequest } from "./updates";

export function send(deps: TestDeps, update: Update | string, secret: string | null = SECRET): Promise<Response> {
  return handleRequest(webhookRequest(update, secret), deps, SECRET);
}

// Scorciatoie per il proprietario in chat privata.
export function say(deps: TestDeps, text: string): Promise<Response> {
  return send(deps, textUpdate(OWNER_ID, text));
}

export function press(deps: TestDeps, data: string, messageId = 1): Promise<Response> {
  return send(deps, callbackUpdate(OWNER_ID, data, messageId));
}

let nextFile = 1;

// Il proprietario invia un file: registrato nel fake e inviato come documento. `size` undefined =
// dimensione reale, null = file_size assente.
export function sendFile(deps: TestDeps, fileName: string, content: string | Uint8Array, size?: number | null): Promise<Response> {
  const fileId = `file${nextFile++}`;
  deps.tg.addFile(fileId, content);
  const bytes = typeof content === "string" ? new TextEncoder().encode(content).byteLength : content.byteLength;
  const fileSize = size === null ? undefined : (size ?? bytes);
  return send(deps, documentUpdate(OWNER_ID, fileName, fileId, fileSize));
}
