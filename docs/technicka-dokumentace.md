# idea-bank — technická dokumentace

Interní popis architektury, pravidel parsování a rozhodnutí za designem.

---

## 1. Architektura

```
┌──────────────────────────────────────────────────────────┐
│  Claude Code / Hermes                                    │
│     │  JSON-RPC 2.0 přes stdin/stdout                    │
│     ▼                                                    │
│  idea-bank (node dist/index.js)                          │
│     ├── tools/     → 7 nástrojů                          │
│     ├── resources/ → 3 URI                               │
│     ├── parse.ts   → projects.md, status.md              │
│     └── ideas.ts   → ideas.json (0600, gitignored)       │
└──────────────────────────────────────────────────────────┘
```

Server je **jednoprocesový, bezstavový** (kromě `ideas.json`). Každé volání nástroje
znovu načte a naparsuje zdrojové soubory — žádná cache, takže změny v `projects.md`
se projeví okamžitě, bez restartu serveru.

### Transport

`serveStdio(() => buildServer())` z `@modelcontextprotocol/server/stdio`.

`buildServer()` je factory — SDK volá novou instanci pro každé připojení.

### Závislosti

| Balík | Proč |
|---|---|
| `@modelcontextprotocol/server` | MCP SDK v2 (nová struktura importů) |
| `zod/v4` | schémata vstupů nástrojů |
| `tsx` (dev) | spouštění TS bez buildu při vývoji |
| `typescript` (dev) | build do `dist/` |

> Pozor: starší návody používají `@modelcontextprotocol/sdk`. Tento projekt je na **v2**,
> kde se importuje z `@modelcontextprotocol/server`.

---

## 2. Formát zdrojových dat

### `projects.md` — katalog

```markdown
## 🌐 Weby                       ← kategorie (## sekce)

| Projekt | Popis | Stack |     ← hlavička tabulky
|---------|-------|-------|
| **basic-web** | ... | Caddy, Python |   ← data
```

Pravidla parseru:

1. Kategorie = každá `## ` sekce. Emoji se vytáhne z titulku (`\p{Extended_Pictographic}`).
2. Tabulky se čtou jen uvnitř kategorie.
3. Sloupec se hledá podle hlavičky: `Projekt`, `Popis`, `Stack` (case-insensitive, substring).
4. Tabulky bez sloupce `Stack` jsou povolené — stack se pak odvodí z popisu.
5. Sekce bez projektů se z výsledku vyřazují.

### `status.md` — stav

```markdown
## 🔴 1. Kritické — běží teď, drží produkci

| # | Projekt | Poznámka |
|---|---|---|
| 1 | `basic-web` | ... |
```

Parser:

- Hlavička tabulky se **přeskočí** (index sloupce s „projekt" se zjistí z ní).
- Oddělovač `|---|---|` se přeskakuje.
- `###` nadpis ukončí aktuální tabulku (nová tabulka = nová hlavička).
- TODO položky se čtou z `- [ ] \`název\``.
- Odstavcové seznamy v backticích (`\`lafe-web\` · \`poradna\``) se čtou jako projekty.

---

## 3. Detekce stacku

Dvě úrovně:

| Úroveň | Zdroj | Pravidlo |
|---|---|---|
| Explicitní | sloupec `Stack` | rozdělení čárkou |
| Heuristika | popis + stack | substring match proti `TECH_KEYWORDS` |
| Krátké názvy | popis + stack | regex na hranici slova (`WORD_TECH`) |

Krátké názvy (`Go`, `R`, `C#`, `C++`, `F#`) **musí** jít přes hranici slova, jinak
`Go` chytí „ground". Regex se escapuje (`C++` by jinak shodil `RegExp`).

Důsledek: technologie zmíněná jen v popisu se počítá jako použitá. Je to záměrný
kompromis — lepší falešně pozitivní „máš Go", než falešně negativní „chybí ti Go",
když ho používáš.

---

## 4. Gap analýza

```ts
domainsMissing = DOMAINS.filter(d => !d.match.test(allText))
techUnused     = TECH_GAPS.filter(t => !usedStack.has(t))
```

`allText` zahrnuje **katalog i status** (`status.md`). To je klíčové: bez toho by
server navrhoval `code-server`/`webtop`/`wireguard`, i když už jsou v to-do.

`DOMAINS` je referenční taxonomie 13 domén (web, backend, AI, bezpečnost, DevOps,
monitoring, média, databáze, automatizace, mobil, desktop, hry, IoT).

---

## 5. Idea banka

```json
{
  "id": "uuid",
  "title": "...",
  "platform": "...",
  "category": "...",
  "prinos": "...",
  "obtiznost": 1,
  "createdAt": "ISO-8601"
}
```

Nápady jsou **obecná projektová zadání** (ne odvozeniny z portfolia).
`obtiznost`: 1 začátečník, 2 mírně pokročilý, 3 pokročilý, 4 expert
(výchozí 2, pokud se neuvede).

- Ukládá se celé pole (read-modify-write), ne databáze — objem je malý.
- Zápis s `mode: 0o600`.
- Poškozený nebo chybějící soubor → `[]` (server nespadne).

### Zásada: banka se neplní odvozeninami

`add_idea` se **nikdy** nevolá automaticky po gap analýze. Portfolio je kontext,
ne generátor obsahu. Viz `CLAUDE.md`.

---

## 6. Rozšíření

### Přidání nástroje

```ts
server.registerTool(
  'nazev',
  { description: '...', inputSchema: z.object({ ... }) },
  async ({ ... }) => text(vysledek),
);
```

`text()` serializuje výsledek jako JSON do `content[0].text`.

### Přidání resource

```ts
server.registerResource(
  'jmeno', 'idea-bank://cesta',
  { title: 'Titulek', mimeType: 'text/markdown' },
  async (uri) => ({ contents: [{ uri: uri.href, text: '...' }] }),
);
```

### Přidání zdroje dat

1. Cesta do `src/config.ts` (`PATHS`).
2. Parser do `src/parse.ts`.
3. Nástroj do `src/index.ts`.
4. Test přes stdio (viz README).

---

## 7. Řešení problémů

| Problém | Příčina / řešení |
|---|---|
| Nástroje se v Claude Code neobjeví | MCP se načítá při startu → restartovat |
| `get_gaps` hlásí mezeru, kterou máš | Katalog zaostává → doplnit `projects.md` |
| Prázdné kategorie | Tabulka nemá hlavičku `Projekt` nebo je mimo `##` sekci |
| `Invalid regular expression` | Neescapovaný metasymbol v `WORD_TECH` |
| Server nenajde soubory | Cesty jsou odvozené z `homedir()`; jiný uživatel = jiné cesty |

---

## 8. Známá omezení

- Parser neošetřuje vnořené tabulky ani tabulky v seznamech.
- Kategorie se filtrují podle počtu projektů — prázdná sekce zmizí.
- `list_stack` počítá každou technologii jednou na projekt (ne výskyty v textu).
- Žádná cache — každé volání čte soubory z disku (u 35 projektů zanedbatelné).

---

## 9. Nasazení pro veřejnost — oddělení pojmů

Při úvaze o „zveřejnění" je snadné smíchat tři nezávislé věci. Držíme je oddělené:

| Vrstva | Co to je | Kde to žije |
|---|---|---|
| **Repo** | zdrojový kód + historie | GitHub / Gitea — kdekoliv |
| **Distribuce** | jak si to někdo stáhne | `git clone` nebo `npm install` / `npx` |
| **Hostování** | běžící proces, ke kterému se klient připojuje | tvůj server, nebo uživatelův počítač |

**Klíčové:** GitHub není potřeba k žádné z těchto vrstev samotných. Gitea zvládne repo
i distribuci přes `git clone`. GitHub pomáhá až ve dvou konkrétních bodech — viz níže.

### Dvě podoby „pro veřejnost" — zásadně odlišné

#### A) Uživatel si server spustí u sebe (stdio)

```
npm install -g idea-bank     # nebo npx idea-bank
# uživatel si ho přidá do Claude Code → běží u něj, čte JEHO soubory
```

- **Nikdo nic nehostuje.** Autor jen publikuje kód.
- Uživatel má vlastní `projects.md` a vlastní `ideas.json` (vlastní banku).
- Této podobě odpovídá **současný design** (stdio, cesty přes `homedir()`).
- GitHub tu pomáhá: **objevitelnost** (lidi hledají MCP na GitHubu) a **npm** (odkaz na repo).

#### B) Autor hostuje server (HTTP/SSE)

```
uživatel → https://mcp.<domena> → běžící server (autorův)
```

- Vyžaduje přepsat transport na `StreamableHTTPServerTransport` + autentizaci + TLS + limity.
- **GitHub tu není potřeba vůbec** — je to čistě provozní otázka.
- Naráží na koncept: čí data by server četl? Cizí `projects.md` na autorově serveru nedává smysl.

### Co to znamená pro tento projekt

idea-bank je **osobní nástroj** — čte soubory konkrétního uživatele. Pro veřejnost má smysl
jen varianta **A** (distribuce jako balíček), ne B (hostování služby).

Praktický důsledek:

- **Teď:** primární repo na Gitee (privátní, pod vlastní kontrolou), bez nutnosti řešit veřejnost.
- **Až k publikaci:** GitHub jako veřejné zrcadlo + publikace na npm (`npx idea-bank`).
- Před zveřejněním je nutné **vyčistit osobní údaje** z dokumentace (absolutní cesty
  `/home/lafe_trap`, popis infrastruktury) — viz `config.ts`, odkud jsou cesty odvozené.

### Konfigurovatelné cesty (předpoklad pro distribuci)

Aby si mohl nástroj spustit cizí uživatel se svými soubory, cesty nejsou natvrdo
v `homedir()` — každá se dá přepsat proměnnou prostředí (viz `config.ts`):

| Proměnná | Výchozí |
|---|---|
| `IDEA_BANK_PROJECTS_MD` | `~/projects/projects.md` |
| `IDEA_BANK_STATUS_MD` | `~/projects/status.md` |
| `IDEA_BANK_VISION_MD` | `~/vault/AI-CONTROLLER-MEMORY.md` |
| `IDEA_BANK_IDEAS_JSON` | `~/projects/idea-bank/ideas.json` |

Chybějící soubor neshodí server — `parse.ts` vrací prázdný katalog/status
(`readSafe`). To je nutné pro variantu A, kde uživatel nemá tvůj vault ani tvůj `projects.md`.
