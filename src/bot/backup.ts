import { backupDataFromResults, backupReadStatements } from "../db/backup";
import type { Deps } from "../deps";
import { buildBackup, encodeBackup } from "../domain/backup";
import { T, type Counts } from "../texts";
import { toDateString, toIso, toLocal } from "../time";
import type { Ctx } from "./context";

// /backup e backup mensile (RF-26, RF-27, FR-017, FR-022): stesso file e stessa caption, solo
// nella chat del proprietario (FR-024).
export async function sendBackup(deps: Deps, chatId: number): Promise<Counts> {
  const data = backupDataFromResults(await deps.db.batch(backupReadStatements(deps.db)));
  const now = deps.now();
  const counts: Counts = { persons: data.persons.length, groups: data.groups.length, occurrences: data.occurrences.length };
  await deps.tg.sendDocument(
    chatId,
    {
      name: `compleanni-backup-${toDateString(toLocal(now))}.json`,
      content: encodeBackup(buildBackup(data, toIso(now))),
      mimeType: "application/json",
    },
    T.backupCaption(counts.persons, counts.groups, counts.occurrences),
  );
  return counts;
}

export async function handleBackup(ctx: Ctx): Promise<void> {
  await sendBackup(ctx.deps, ctx.chatId);
}
