import { handleRequest } from "../../src/bot/webhook";
import type { Update } from "../../src/telegram/types";
import { OWNER_ID, SECRET } from "./constants";
import type { TestDeps } from "./deps";
import { callbackUpdate, textUpdate, webhookRequest } from "./updates";

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
