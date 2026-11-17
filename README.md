# idea-bank

MCP server, který pomáhá prolomit tvůrčí blok. Ne tím, že by nabídl hotový seznam nápadů,
ale tím, že agentovi (Claude, Hermes) dá **strukturovaný kontext o tvém reálném portfoliu** —
a z něj pak vznikne návrh, který sedí na to, co už máš.

> Server nedává odpověď. Dává materiál pro rozhovor.

---

## Proč to existuje

Když má člověk blok, generický seznam („postav si todo app") nepomůže. Pomůže kontext:
*co už mám, co mi chybí, co se mnou rezonuje*. Tenhle server ho vytáhne z lokálních
souborů a předloží ho agentovi ve chvíli, kdy ho potřebuješ.

Zároveň platí zásada: **do tajné banky jde jen to, co projde tvým úsudkem.** Server sám
banka neplní — kdyby vrátil hotový seznam, neměl bys důvod ho znovu otevírat.

---

## Jak to funguje

```
~/projects/projects.md      ─┐
~/projects/status.md        ─┼─→  MCP server  ─→  agent  ─→  dialog s tebou
~/vault/AI-CONTROLLER-MEMORY.md ─┘         │
                                           └─→  ideas.json  (tajná banka)
```

1. Agent zavolá `analyze_portfolio` a `get_gaps`.
2. Přečte vizi z `idea-bank://vision`.
3. Získá reálný stav: co existuje, co je plánované, kde jsou díry.
4. Navrhne konkrétní projekty zasazené do portfolia.
5. Co schválíš, uloží se přes `add_idea` do tajné banky.

---

## Nástroje (Tools)

### Čtení portfolia — kontext pro doporučení

| Nástroj | Co vrací |
|---|---|
| `list_categories` | kategorie portfolia s počtem projektů a jejich jmény |
| `list_stack` | jazyky a technologie s počtem výskytů napříč portfoliem |
| `analyze_portfolio` | statistiky: počet projektů, kategorie, rozložení podle stavu (kritické / aktivní / plánované / archiv / TODO) |
| `get_gaps` | domény bez jediného projektu + technologie, které se vůbec nepoužívají |

`get_gaps` zohledňuje i **plánované** projekty ze `status.md` — nenavrhne ti něco,
co už máš v to-do.

### Tajná idea banka — read-write

| Nástroj | Co dělá |
|---|---|
| `list_ideas` | vypíše uložené nápady |
| `add_idea` | uloží nápad (`title` povinný; `platform`, `category`, `prinos`, `obtiznost` doporučené) |
| `remove_idea` | smaže nápad podle `id` |

### Struktura nápadu

Nápady jsou **obecná projektová zadání**, ne odvozeniny z portfolia.

| Pole | Význam |
|---|---|
| `title` | název zadání („Zprovoznit Nginx v Dockeru") |
| `platform` | jazyk / technologie (bash, C#, Python, PowerShell…) |
| `category` | typ projektu — viz taxonomie níže |
| `prinos` | co se na tom naučíš |
| `obtiznost` | 1–4 (viz tabulka) |

**Obtížnost:**

| Level | Název | Rozsah |
|---|---|---|
| 1 | Začátečník | 1–2 h, jeden nástroj |
| 2 | Mírně pokročilý | víkend, 2–3 komponenty |
| 3 | Pokročilý | týden+, architektura, více služeb |
| 4 | Expert | měsíc, vlastní implementace, výkon, bezpečnost |

**Kategorie:**

`databáze` · `vizualizace dat` · `monitoring` · `linux` · `shell / bash` ·
`skriptování` · `sítě` · `web` · `windows / PowerShell` · `C++ / C#` · `AI / ML`

---

## Resources (procházení v UI)

| URI | Obsah |
|---|---|
| `idea-bank://portfolio/katalog` | `~/projects/projects.md` |
| `idea-bank://portfolio/status` | `~/projects/status.md` |
| `idea-bank://vision` | `~/vault/AI-CONTROLLER-MEMORY.md` |

---

## Instalace

```bash
cd ~/projects/idea-bank
npm install
npm run build          # tsc → dist/
```

Požadavky: Node 22+, npm. Server je čistě ESM TypeScript, běží přes `node dist/index.js`.

## Připojení do Claude Code

```bash
claude mcp add --scope user idea-bank node /home/lafe_trap/projects/idea-bank/dist/index.js
claude mcp list          # → idea-bank: ✔ Connected
```

Pro připojení jen v jednom projektu použij `.mcp.json` v kořeni projektu:

```json
{
  "mcpServers": {
    "idea-bank": {
      "command": "node",
      "args": ["/home/lafe_trap/projects/idea-bank/dist/index.js"]
    }
  }
}
```

Po přidání serveru je potřeba **restartovat Claude Code** — MCP nástroje se načítají při startu.

---

## Používání

Není potřeba volat nástroje ručně. Stačí říct:

> „Nevím, co stavět."

Agent si sám vyžádá kontext a navrhne projekty. Když chceš konkrétnější odpověď:

> „Co bych mohl postavit v Rustu?"
> „Jaké mám mezery v portfoliu?"
> „Jaké technologie používám nejvíc?"

Uložení nápadu:

> „Ulož to do banky."

---

## Soukromí a bezpečnost

| Vlastnost | Jak je zajištěno |
|---|---|
| Banka není veřejná | `ideas.json` v `.gitignore`, práva `0600` |
| Bez otevřeného portu | stdio transport — server je podproces, ne služba na síti |
| Bez internetu | čte jen lokální soubory, žádná síťová volání |
| Bez citlivých hodnot | načítá pouze katalog, status a vizi |

> DNS záznam ani reverse proxy tomuto serveru nepomohou — nemá síťové rozhraní.
> Pro vzdálený přístup by bylo potřeba přepsat transport na HTTP/SSE a doplnit autentizaci.

---

## Struktura projektu

```
idea-bank/
├── src/
│   ├── index.ts      # server, nástroje, resources, gap analýza
│   ├── parse.ts      # parser projects.md / status.md
│   ├── ideas.ts      # read-write tajná banka
│   └── config.ts     # cesty ke zdrojům
├── docs/
│   └── technicka-dokumentace.md
├── dist/             # build (gitignored)
├── ideas.json        # TAJNÉ (gitignored)
├── CLAUDE.md         # pravidla pro agenty
└── README.md
```

## Vývoj

```bash
npm run dev        # tsx watch
npm run typecheck  # tsc --noEmit
npm run build      # tsc → dist/
```

Ruční test přes stdio:

```bash
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"0"}}}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_gaps","arguments":{}}}' \
  | node dist/index.js
```

## Omezení

- Kvalita doporučení = kvalita `projects.md`. Když katalog zaostává za realitou,
  gap analýza hlásí falešné mezery. Katalog je potřeba udržovat.
- Parser je heuristický (markdown tabulky + detekce klíčových slov), ne přesná analýza.
- Detekce stacku je odhad — technologie zmíněná v popisu se počítá jako použitá.
