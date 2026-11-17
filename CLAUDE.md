# CLAUDE.md — idea-bank

MCP server (TypeScript/Node, SDK `@modelcontextprotocol/server` v2), který čte lokální portfolio
a tajnou idea banku. Cíl: pomoct prolomit tvůrčí blok tím, že dá agentovi strukturovaný stav
portfolia, ze kterého doporučí konkrétní nové projekty.

## Stack

- Node 22, ESM (`"type": "module"`), TypeScript (strict), runner `tsx`.
- SDK: `@modelcontextprotocol/server` (v2) + `zod/v4` (ne starý `@modelcontextprotocol/sdk`).
- `serveStdio(() => buildServer())` z `@modelcontextprotocol/server/stdio`.

## Struktura

- `src/index.ts` — server, nástroje, resources, gap analýza.
- `src/parse.ts` — parser `projects.md` / `status.md` (kategorie + markdown tabulky).
- `src/ideas.ts` — read-write tajná idea banka (`ideas.json`, 0600).
- `src/config.ts` — cesty ke zdrojům (home-dir).

## Zásady

- **Tajnost banky:** `ideas.json` je v `.gitignore`, nikdy necommittovat, práva `0600`.
- **Banka NENÍ odvozenina portfolia.** Nikdy neplnit banku automaticky z `get_gaps`
  ani z jiného výstupu portfolia. Portfolio a gap analýza jsou jen **kontext pro
  dialog**; do banky jde výhradně to, co projde úsudkem uživatele.
  Důvod: kdyby server vrátil hotový seznam nápadů, uživatel nemá důvod ho znovu
  otevírat — hodnota je v procesu (kontext → dialog → nápad), ne v datech.
- **Jen lokální čtení.** Žádný internet, žádné citlivé hodnoty, žádný otevřený port.
- Data zdroje: `~/projects/projects.md`, `~/projects/status.md`, `~/vault/AI-CONTROLLER-MEMORY.md`.
- Parser je heuristický (markdown tabulky, detekce klíčových slov stacku) — ne přesná analýza.
- Po změně parseru ověř: `npm run typecheck` a ruční test `npx tsx src/index.ts` přes stdio.

## Test MCP přes stdio

```bash
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | npx tsx src/index.ts
```
