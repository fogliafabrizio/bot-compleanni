import { RECEIVED_FILE_MAX_BYTES, TELEGRAM_DOWNLOAD_MAX_BYTES } from "../config";
import type { ConversationState } from "../db/conversation";
import { TelegramError } from "../telegram/client";
import type { Document } from "../telegram/types";
import { T } from "../texts";
import { reply, type Ctx } from "./context";
import { handleBackupFile } from "./flows/ripristina";
import { handleCsv } from "./import";

// Documenti ricevuti (contracts/comandi.md, research R-01, R-13): tipo dall'estensione, limiti di
// dimensione prima di getFile, download e instradamento. La caption è ignorata.

function extension(name: string | undefined): string {
  const n = (name ?? "").toLowerCase();
  const dot = n.lastIndexOf(".");
  return dot >= 0 ? n.slice(dot) : "";
}

export function awaitsBackupFile(state: ConversationState | null): state is ConversationState {
  return state?.flow === "ripristina" && state.step === "file";
}

// V-07, FR-026: oltre i limiti nessuna chiamata; un errore di download lascia il flusso invariato.
async function downloadDocument(ctx: Ctx, doc: Document): Promise<Uint8Array | null> {
  if (doc.file_size !== undefined && doc.file_size > TELEGRAM_DOWNLOAD_MAX_BYTES) {
    await reply(ctx, T.fileTooBigTelegram);
    return null;
  }
  if (doc.file_size !== undefined && doc.file_size > RECEIVED_FILE_MAX_BYTES) {
    await reply(ctx, T.fileTooBig);
    return null;
  }
  let bytes: Uint8Array;
  try {
    const f = await ctx.deps.tg.getFile(doc.file_id);
    bytes = await ctx.deps.tg.downloadFile(f.file_path);
  } catch (err) {
    if (!(err instanceof TelegramError)) throw err;
    await reply(ctx, T.downloadFailed);
    return null;
  }
  // Research R-01: la dimensione reale si ricontrolla dopo il download.
  if (bytes.byteLength > RECEIVED_FILE_MAX_BYTES) {
    await reply(ctx, T.fileTooBig);
    return null;
  }
  return bytes;
}

export async function handleDocument(ctx: Ctx, doc: Document, state: ConversationState | null): Promise<void> {
  const ext = extension(doc.file_name);
  if (ext === ".csv") {
    const bytes = await downloadDocument(ctx, doc);
    if (bytes) await handleCsv(ctx, bytes, state);
    return;
  }
  if (ext === ".json" && awaitsBackupFile(state)) {
    const bytes = await downloadDocument(ctx, doc);
    if (bytes) await handleBackupFile(ctx, bytes, state);
    return;
  }
  // Un JSON fuori da /ripristina o un altro tipo di file non cambiano il flusso in corso.
  if (ext === ".json") await reply(ctx, T.useRipristina);
  else await reply(ctx, awaitsBackupFile(state) ? T.waitingBackupFile : T.sendCsv);
}
