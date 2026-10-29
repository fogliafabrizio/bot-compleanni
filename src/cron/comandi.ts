import { getBotCommandsHash, saveBotCommandsHash } from "../db/settings";
import type { CronDeps } from "../deps";
import { nameHash } from "../domain/text";
import { BOT_COMMANDS } from "../texts";
import { toIso } from "../time";

// Menu dei comandi (FR-014, research R-10): registrato con setMyCommands solo quando BOT_COMMANDS
// cambia rispetto all'hash salvato. Costo: 1 D1 a vuoto; 2 D1 + 1 Telegram quando cambia.
export async function syncBotCommands(deps: CronDeps): Promise<void> {
  const hash = nameHash(JSON.stringify(BOT_COMMANDS));
  if ((await getBotCommandsHash(deps.db)) === hash) return;
  await deps.tg.setMyCommands(BOT_COMMANDS);
  await saveBotCommandsHash(deps.db, hash, toIso(deps.now()));
}
