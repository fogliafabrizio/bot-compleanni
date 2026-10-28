import { env } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../../src/env";
import worker from "../../src/index";
import { T } from "../../src/texts";
import { OWNER_ID, SECRET } from "../helpers/constants";
import { makeDeps } from "../helpers/deps";
import { say } from "../helpers/send";
import { textUpdate, webhookRequest } from "../helpers/updates";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("RNF-04: segreti solo come binding della piattaforma", () => {
  it("RNF-04: token del bot e ID del proprietario arrivano dall'ambiente del Worker", async () => {
    const urls: string[] = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      urls.push(String(input));
      return new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }));
    });
    const handler = worker as ExportedHandler<Env>;
    const res = await handler.fetch!(
      webhookRequest(textUpdate(OWNER_ID, "/aiuto"), SECRET) as Request<unknown, IncomingRequestCfProperties>,
      env as unknown as Env,
      {} as ExecutionContext,
    );
    expect(res.status).toBe(200);
    // test-token e 1001 sono i binding fittizi di vitest.config.ts.
    expect(urls).toEqual(["https://api.telegram.org/bottest-token/sendMessage"]);
  });
});

describe("RNF-15: testi raccolti in src/texts.ts", () => {
  it("RNF-15: le risposte del bot coincidono con i testi centralizzati", async () => {
    const deps = makeDeps();
    await say(deps, "/aiuto");
    expect(deps.tg.lastText()).toBe(T.help);
    await say(deps, "ciao");
    expect(deps.tg.lastText()).toBe(T.notUnderstood);
    await say(deps, "/nuovo");
    expect(deps.tg.lastText()).toBe(T.askFullName);
    await say(deps, "/annulla");
    expect(deps.tg.lastText()).toBe(T.cancelled);
  });
});
