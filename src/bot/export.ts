import { CSV_COLUMNS } from "../config";
import { exportFromResults, exportReadStatements } from "../db/backup";
import { writeCsv } from "../domain/csv";
import { exportRow } from "../domain/import";
import { CSV_EXAMPLE_ROW, T } from "../texts";
import { toDateString, toLocal } from "../time";
import type { Ctx } from "./context";

// /modello e /export (RF-23, RF-25, contracts/csv.md "Scrittura"): file solo nella chat del
// proprietario (FR-024).

const CSV_MIME = "text/csv; charset=utf-8";

export async function handleTemplate(ctx: Ctx): Promise<void> {
  await ctx.deps.tg.sendDocument(
    ctx.chatId,
    { name: "compleanni-modello.csv", content: writeCsv([CSV_COLUMNS, CSV_EXAMPLE_ROW]), mimeType: CSV_MIME },
    T.templateCaption,
  );
}

export async function handleExport(ctx: Ctx): Promise<void> {
  const people = exportFromResults(await ctx.deps.db.batch(exportReadStatements(ctx.deps.db)));
  const rows = people.map((p) => exportRow(p.person, p.groups));
  await ctx.deps.tg.sendDocument(
    ctx.chatId,
    {
      name: `compleanni-export-${toDateString(toLocal(ctx.deps.now()))}.csv`,
      content: writeCsv([CSV_COLUMNS, ...rows]),
      mimeType: CSV_MIME,
    },
    T.exportCaption(rows.length),
  );
}
