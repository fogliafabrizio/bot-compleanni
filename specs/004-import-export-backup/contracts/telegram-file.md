# Contratto — Estensioni del client Telegram e dei tipi

Riferimenti: V-07, RNF-09, principi III, IV, V. Codice: `src/telegram/client.ts`,
`src/telegram/types.ts`. Nessuna dipendenza nuova: `fetch`, `FormData`, `Blob` del runtime.

## Tipi

```ts
export interface Document {
  file_id: string;
  file_unique_id: string;
  file_name?: string;
  mime_type?: string;   // non usato per decidere (research R-01)
  file_size?: number;
}

export interface Message {
  // … campi esistenti
  document?: Document;
  caption?: string;     // ignorata
}
```

## Metodi nuovi di `TelegramApi`

```ts
sendDocument(
  chatId: number,
  file: { name: string; content: Uint8Array; mimeType: string },
  caption?: string,
): Promise<{ message_id: number }>;

getFile(fileId: string): Promise<{ file_path: string; file_size?: number }>;

// Scarica https://api.telegram.org/file/bot<token>/<file_path>; errore HTTP → TelegramError(status).
downloadFile(filePath: string): Promise<Uint8Array>;
```

- `sendDocument`: `POST /sendDocument` con `multipart/form-data` (`chat_id`, `document` come
  `Blob` con nome file, `caption` se presente). Nessun `parse_mode`.
- `getFile`: `POST /getFile` JSON `{ file_id }` come gli altri metodi.
- `downloadFile`: `GET` del file; il token compare solo nell'URL interno, mai in log o errori.
- Errori: `TelegramError(errorCode)` come gli altri metodi; nessun contenuto nei messaggi.

## Fake per i test (`test/helpers/fake-telegram.ts`)

- registra `{ method: "sendDocument", chatId, name, mimeType, text, caption? }` con il
  contenuto decodificato in UTF-8 (BOM compreso) per le asserzioni;
- `addFile(fileId, content, filePath?)` popola i file scaricabili; `getFile` di un id sconosciuto
  → `TelegramError(400)`;
- errori simulabili su `sendDocument`, `getFile`, `downloadFile` come per `sendMessage`;
- ogni chiamata conta nel contatore di subrequest dei test di budget.
