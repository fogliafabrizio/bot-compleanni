# bot-compleanni

Bot Telegram personale per ricordare i compleanni.

- Stack: Cloudflare Workers (TypeScript) + D1 + Cron Trigger, costo zero.
- Metodo: spec-driven development con [spec-kit](https://github.com/github/spec-kit) e Claude Code.
- Analisi funzionale: docs/AFU.md
- Come procedere: docs/PROSSIMI_PASSI.md

## Sviluppo

```powershell
npm install          # dipendenze di sviluppo (wrangler, typescript, vitest, @cloudflare/vitest-plugin)
npm run types        # rigenera worker-configuration.d.ts dopo modifiche a wrangler.jsonc
npm run typecheck    # tsc --noEmit (strict)
npm test             # vitest nel runtime Workers, D1 locale, Telegram simulato
npm run dev          # wrangler dev (secret in .dev.vars, copiato da .dev.vars.example)
```

Validazione completa della feature e deploy: `specs/001-fondamenta-anagrafica/quickstart.md`.
