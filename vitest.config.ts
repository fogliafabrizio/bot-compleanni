import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig(async () => {
  const migrations = await readD1Migrations("./migrations");
  return {
    plugins: [
      cloudflareTest({
        main: "./src/index.ts",
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          // Valori fittizi: non sono segreti reali (RNF-04).
          bindings: {
            TEST_MIGRATIONS: migrations,
            OWNER_TELEGRAM_ID: "1001",
            WEBHOOK_SECRET: "test-secret",
            TELEGRAM_BOT_TOKEN: "test-token",
          },
        },
      }),
    ],
    test: {
      setupFiles: ["./test/setup.ts"],
    },
  };
});
