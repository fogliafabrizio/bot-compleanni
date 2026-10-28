import { describe, expect, it } from "vitest";
import {
  renderGiorno,
  renderGiornoAfter,
  renderPre,
  renderPreAfter,
  renderRecupero,
  renderRecuperoAfter,
  type ReminderData,
} from "../../src/bot/promemoria";
import { buttons, cbOf, copyOf, labels, urlOf } from "../helpers/fake-telegram";

type Over = Partial<Omit<ReminderData, "person">> & { person?: Partial<ReminderData["person"]> };

function data(over: Over = {}): ReminderData {
  const { person, ...rest } = over;
  return {
    actionTarget: { scope: "o", id: 77 },
    groups: [],
    lastYear: null,
    year: 2027,
    greeting: "Tanti auguri Marchino! 🎉",
    ...rest,
    person: {
      fullName: "Marco Rossi",
      nickname: "Marchino",
      birthDay: 14,
      birthMonth: 3,
      birthYear: 1995,
      phone: null,
      instagram: null,
      telegram: null,
      ...person,
    },
  };
}

const line1 = (text: string) => text.split("\n")[0];

describe("RF-10, §5.3: testo del reminder del giorno", () => {
  it("RF-10: nickname diverso dal nome ed età", () => {
    expect(line1(renderGiorno(data()).text)).toBe("🎂 Oggi è il compleanno di Marchino (Marco Rossi), compie 32 anni");
  });

  it("RF-10: senza nickname solo il nome; nickname uguale al nome non ripetuto", () => {
    expect(line1(renderGiorno(data({ person: { nickname: null } })).text)).toBe(
      "🎂 Oggi è il compleanno di Marco Rossi, compie 32 anni",
    );
    expect(line1(renderGiorno(data({ person: { nickname: "Marco Rossi" } })).text)).toBe(
      "🎂 Oggi è il compleanno di Marco Rossi, compie 32 anni",
    );
  });

  it("BR-03: senza anno di nascita nessuna età", () => {
    expect(line1(renderGiorno(data({ person: { birthYear: null } })).text)).toBe(
      "🎂 Oggi è il compleanno di Marchino (Marco Rossi)",
    );
  });

  it("BR-04: nato il 29/02, anno non bisestile → nota in fondo alla prima riga", () => {
    const d = data({ person: { birthDay: 29, birthMonth: 2, birthYear: 1996 } });
    expect(line1(renderGiorno(d).text)).toBe(
      "🎂 Oggi è il compleanno di Marchino (Marco Rossi), compie 31 anni (compleanno il 29/02)",
    );
    expect(line1(renderGiorno({ ...d, year: 2028 }).text)).not.toContain("29/02");
  });

  it("RF-10: righe Gruppi (alfabetiche), telefono e L'anno scorso solo con il dato", () => {
    const full = renderGiorno(data({ groups: ["Lavoro", "beach tennis"], person: { phone: "+393331234567" }, lastYear: "fatto" }));
    expect(full.text.split("\n")).toEqual([
      "🎂 Oggi è il compleanno di Marchino (Marco Rossi), compie 32 anni",
      "Gruppi: beach tennis, Lavoro",
      "📱 +393331234567",
      "L'anno scorso: fatto ✅",
    ]);
    expect(renderGiorno(data({ lastYear: "saltato" })).text.split("\n").at(-1)).toBe("L'anno scorso: saltato");
    expect(renderGiorno(data()).text.split("\n")).toHaveLength(1);
  });

  it("BR-09: esito precedente non confermato → nessuna riga L'anno scorso", () => {
    expect(renderGiorno(data({ lastYear: "non_confermato" })).text).not.toContain("L'anno scorso");
  });
});

describe("RF-11, V-04…V-06: tastiera del reminder del giorno", () => {
  const all = data({ person: { phone: "+393331234567", instagram: "marco.rossi", telegram: "marcor" } });

  it("RF-11: tre righe — contatti, Copia messaggio, esiti", () => {
    const kb = renderGiorno(all).keyboard;
    expect(kb.inline_keyboard.map((r) => r.map((b) => b.text))).toEqual([
      ["WhatsApp", "Instagram", "Telegram"],
      ["Copia messaggio"],
      ["Fatto ✅", "Salta quest'anno"],
    ]);
    expect(cbOf(kb, "Fatto ✅")).toBe("o:f:77");
    expect(cbOf(kb, "Salta quest'anno")).toBe("o:s:77");
  });

  it("V-06, BR-03: WhatsApp con numero internazionale senza + e auguri senza età", () => {
    expect(urlOf(renderGiorno(all).keyboard, "WhatsApp")).toBe(
      "https://wa.me/393331234567?text=Tanti%20auguri%20Marchino!%20%F0%9F%8E%89",
    );
  });

  it("V-05: Instagram e Telegram senza testo, username codificato", () => {
    const kb = renderGiorno(data({ person: { instagram: "a b", telegram: "marcor" } })).keyboard;
    expect(urlOf(kb, "Instagram")).toBe("https://ig.me/m/a%20b");
    expect(urlOf(kb, "Telegram")).toBe("https://t.me/marcor");
  });

  it("RF-11: solo i contatti presenti", () => {
    const kb = renderGiorno(data({ person: { phone: "+393331234567", instagram: "marco" } })).keyboard;
    expect(labels(kb)).toEqual(["WhatsApp", "Instagram", "Copia messaggio", "Fatto ✅", "Salta quest'anno"]);
    expect(labels(renderGiorno(data()).keyboard)).toEqual(["Copia messaggio", "Fatto ✅", "Salta quest'anno"]);
  });

  it("V-04: nessun pulsante tel: o sms:, solo https:// e copia", () => {
    for (const [, v] of buttons(renderGiorno(all).keyboard)) expect(v).not.toMatch(/^(tel|sms):/);
    for (const b of renderGiorno(all).keyboard.inline_keyboard.flat()) {
      if ("url" in b) expect(b.url).toMatch(/^https:\/\//);
    }
  });

  it("FR-029: Copia messaggio copia gli auguri; oltre 256 caratteri il pulsante non c'è", () => {
    expect(copyOf(renderGiorno(all).keyboard, "Copia messaggio")).toBe("Tanti auguri Marchino! 🎉");
    expect(labels(renderGiorno(data({ greeting: "x".repeat(257) })).keyboard)).not.toContain("Copia messaggio");
    expect(labels(renderGiorno(data({ greeting: "🎉".repeat(256) })).keyboard)).toContain("Copia messaggio");
  });

  it("RF-12: dopo Fatto o Salta, riga dell'esito e soli contatti", () => {
    const f = renderGiornoAfter(all, "fatto");
    expect(f.text).toBe(`${renderGiorno(all).text}\n\n✅ Fatto`);
    expect(labels(f.keyboard)).toEqual(["WhatsApp", "Instagram", "Telegram", "Copia messaggio"]);
    const s = renderGiornoAfter(all, "saltato");
    expect(s.text.endsWith("\n\nSaltato")).toBe(true);
    expect(labels(s.keyboard)).toEqual(["WhatsApp", "Instagram", "Telegram", "Copia messaggio"]);
  });
});

describe("RF-13, §5.5: recupero", () => {
  it("RF-13: testo con telefono solo se presente (chiarimento 2026-10-28)", () => {
    expect(renderRecupero(data()).text).toBe("⏰ Ieri era il compleanno di Marchino (Marco Rossi). Hai fatto gli auguri?");
    expect(renderRecupero(data({ person: { phone: "+393331234567", nickname: null } })).text).toBe(
      "⏰ Ieri era il compleanno di Marco Rossi. Hai fatto gli auguri?\n📱 +393331234567",
    );
  });

  it("RF-13: tastiera contatti + copia su una riga, poi Fatto / Saltato", () => {
    const kb = renderRecupero(data({ person: { phone: "+393331234567", instagram: "m", telegram: "t" } })).keyboard;
    expect(kb.inline_keyboard.map((r) => r.map((b) => b.text))).toEqual([
      ["WhatsApp", "Instagram", "Telegram", "Copia messaggio"],
      ["Fatto ✅", "Saltato"],
    ]);
    expect(cbOf(kb, "Saltato")).toBe("o:s:77");
  });

  it("BR-08: dopo Fatto soli contatti; dopo Saltato contatti + Fatto per la correzione", () => {
    const d = data({ person: { phone: "+393331234567" } });
    const f = renderRecuperoAfter(d, "fatto");
    expect(f.text.endsWith("\n\n✅ Fatto")).toBe(true);
    expect(labels(f.keyboard)).toEqual(["WhatsApp", "Copia messaggio"]);
    const s = renderRecuperoAfter(d, "saltato");
    expect(s.text.endsWith("\n\nSaltato")).toBe(true);
    expect(labels(s.keyboard)).toEqual(["WhatsApp", "Copia messaggio", "Fatto ✅"]);
    expect(cbOf(s.keyboard, "Fatto ✅")).toBe("o:f:77");
  });
});

describe("RF-09, §5.4: pre-reminder", () => {
  it("RF-09: testo con età e data", () => {
    expect(renderPre(data(), 7).text).toBe("📅 Tra 7 giorni: compleanno di Marchino (32 anni) — 14/03");
  });

  it("RF-09: Tra 1 giorno al singolare; senza anno nessuna età", () => {
    expect(renderPre(data({ person: { birthYear: null } }), 1).text).toBe("📅 Tra 1 giorno: compleanno di Marchino — 14/03");
  });

  it("BR-04: nato il 29/02 → 29/02 anche negli anni non bisestili", () => {
    expect(renderPre(data({ person: { birthDay: 29, birthMonth: 2, birthYear: 1996 } }), 1).text).toBe(
      "📅 Tra 1 giorno: compleanno di Marchino (31 anni) — 29/02",
    );
  });

  it("BR-03, BR-05: età dell'anno dell'occorrenza", () => {
    expect(renderPre(data({ year: 2028 }), 2).text).toContain("(33 anni)");
  });

  it("RF-09: unico pulsante Salta quest'anno; dopo Salta tastiera vuota", () => {
    const kb = renderPre(data(), 2).keyboard;
    expect(buttons(kb)).toEqual([["Salta quest'anno", "o:s:77"]]);
    const after = renderPreAfter(data(), 2);
    expect(after.text).toBe("📅 Tra 2 giorni: compleanno di Marchino (32 anni) — 14/03\n\nSaltato quest'anno");
    expect(after.keyboard).toEqual({ inline_keyboard: [] });
  });
});

describe("RF-16, contracts/callback-data.md di 003: destinazione dei pulsanti di esito", () => {
  it("RF-16: target o → o:f/o:s; target t (/oggi) → t:f/t:s", () => {
    const o = renderGiorno(data()).keyboard;
    expect([cbOf(o, "Fatto ✅"), cbOf(o, "Salta quest'anno")]).toEqual(["o:f:77", "o:s:77"]);
    const t = renderGiorno(data({ actionTarget: { scope: "t", id: 55 } })).keyboard;
    expect([cbOf(t, "Fatto ✅"), cbOf(t, "Salta quest'anno")]).toEqual(["t:f:55", "t:s:55"]);
  });
});
