import { DEFAULT_BIRTHDAY_MESSAGE, GREETING_PLACEHOLDER, TEXT_LIMITS } from "../config";

// Messaggio di auguri (RF-15, FR-031, FR-035, research R-12). Mai l'età (BR-03).

export function composeGreeting(
  p: { nickname: string | null; fullName: string; customMessage: string | null },
  defaultMessage: string | null,
): string {
  const template = p.customMessage ?? defaultMessage ?? DEFAULT_BIRTHDAY_MESSAGE;
  return template.replaceAll(GREETING_PLACEHOLDER, p.nickname ?? p.fullName);
}

// Lunghezza in code point; ogni {nome} vale quanto il nome più lungo ammesso.
export function validateGreeting(input: string): { ok: true; value: string } | { ok: false; error: "empty" | "too_long" } {
  const value = input.trim();
  if (value.length === 0) return { ok: false, error: "empty" };
  const parts = value.split(GREETING_PLACEHOLDER);
  const placeholders = parts.length - 1;
  const length = [...parts.join("")].length + placeholders * TEXT_LIMITS.greetingNamePlaceholder;
  if (length > TEXT_LIMITS.customMessage) return { ok: false, error: "too_long" };
  return { ok: true, value };
}
