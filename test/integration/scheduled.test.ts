import { createExecutionContext, createScheduledController, env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { Env } from "../../src/env";
import worker from "../../src/index";
import { totalRows } from "../helpers/db";

describe("AFU §10: Cron Trigger orario", () => {
  it("AFU §10: l'handler scheduled è vuoto e non scrive nulla", async () => {
    const controller = createScheduledController({ cron: "0 * * * *", scheduledTime: Date.UTC(2026, 9, 28, 10) });
    const handler = worker as ExportedHandler<Env>;
    await handler.scheduled!(controller, env as unknown as Env, createExecutionContext());
    expect(await totalRows()).toBe(0);
  });
});
