import { defineConfig } from "vitest/config";

// Benchmark CPU delle parti pure del ciclo orario (research R-09): ambiente Node, senza il
// plugin Cloudflare, perché nel pool workers l'orologio è fermo durante l'esecuzione.
export default defineConfig({
  test: {
    environment: "node",
    include: [],
    benchmark: { include: ["bench/**/*.bench.ts"] },
  },
});
