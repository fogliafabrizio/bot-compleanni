import type { Update } from "../../src/telegram/types";
import { SECRET } from "./constants";

let nextId = 1;

export function textUpdate(
  fromId: number,
  text: string | undefined,
  chatType: "private" | "group" | "supergroup" | "channel" = "private",
): Update {
  const id = nextId++;
  return {
    update_id: id,
    message: {
      message_id: id,
      from: { id: fromId },
      chat: { id: chatType === "private" ? fromId : -5000, type: chatType },
      ...(text !== undefined ? { text } : {}),
    },
  };
}

export function callbackUpdate(fromId: number, data: string, messageId = 1): Update {
  const id = nextId++;
  return {
    update_id: id,
    callback_query: {
      id: `cq${id}`,
      from: { id: fromId },
      message: { message_id: messageId, chat: { id: fromId, type: "private" } },
      data,
    },
  };
}

export function webhookRequest(update: unknown, secret: string | null = SECRET, method = "POST", path = "/webhook"): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (secret !== null) headers["X-Telegram-Bot-Api-Secret-Token"] = secret;
  return new Request(`https://bot.example${path}`, {
    method,
    headers,
    ...(method === "GET" ? {} : { body: typeof update === "string" ? update : JSON.stringify(update) }),
  });
}
