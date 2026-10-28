import { env } from "cloudflare:test";
import type { CronDeps, Deps } from "../../src/deps";
import { NOW } from "./constants";
import { FakeTelegram } from "./fake-telegram";

const RAW = Symbol("raw");
const PARAMS = Symbol("params");

type Wrapped = { [RAW]?: D1PreparedStatement; [PARAMS]?: number };

// Conta le subrequest D1 (esecuzioni di statement e batch) per i controlli di budget.
export class CountingDb {
  count = 0;
  // Se impostato, ogni accesso a D1 lancia (per simulare errori interni).
  failing = false;
  // Per ogni batch eseguita, il numero di parametri di ciascuno statement (limite D1: 100).
  batches: number[][] = [];

  constructor(private readonly real: D1Database) {}

  private hit(): void {
    if (this.failing) throw new Error("db_failure");
    this.count++;
  }

  private wrap(stmt: D1PreparedStatement, params = 0): D1PreparedStatement {
    const wrapped = {
      [RAW]: stmt,
      [PARAMS]: params,
      bind: (...values: unknown[]) => this.wrap(stmt.bind(...values), values.length),
      first: (col?: string) => {
        this.hit();
        return col === undefined ? stmt.first() : stmt.first(col);
      },
      all: () => {
        this.hit();
        return stmt.all();
      },
      run: () => {
        this.hit();
        return stmt.run();
      },
      raw: () => {
        this.hit();
        return stmt.raw();
      },
    };
    return wrapped as unknown as D1PreparedStatement;
  }

  asD1(): D1Database {
    return {
      prepare: (sql: string) => {
        if (this.failing) throw new Error("db_failure");
        return this.wrap(this.real.prepare(sql));
      },
      batch: (stmts: D1PreparedStatement[]) => {
        this.hit();
        this.batches.push(stmts.map((s) => (s as unknown as Wrapped)[PARAMS] ?? 0));
        return this.real.batch(stmts.map((s) => (s as unknown as Wrapped)[RAW] ?? s));
      },
      exec: (sql: string) => {
        this.hit();
        return this.real.exec(sql);
      },
    } as unknown as D1Database;
  }
}

export interface TestDeps extends Deps {
  tg: FakeTelegram;
  counter: CountingDb;
  setNow(d: Date): void;
}

export function makeDeps(opts: { now?: Date } = {}): TestDeps {
  let current = opts.now ?? NOW;
  const counter = new CountingDb(env.DB);
  return {
    db: counter.asD1(),
    tg: new FakeTelegram(),
    now: () => current,
    ownerId: "1001",
    counter,
    setNow(d: Date) {
      current = d;
    },
  };
}

export interface TestCronDeps extends TestDeps, CronDeps {
  tg: FakeTelegram;
  // Numero di pause richieste tra un invio e l'altro.
  sleeps: number;
}

// Dipendenze del ciclo orario: la pausa tra gli invii è una funzione vuota.
export function makeCronDeps(opts: { now?: Date } = {}): TestCronDeps {
  const deps = makeDeps(opts) as TestCronDeps;
  deps.sleeps = 0;
  deps.sleep = async () => {
    deps.sleeps++;
  };
  return deps;
}
