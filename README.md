# idea-bank

MCP server proti tvůrčímu bloku. Čte lokální portfolio (`projects.md`, `status.md`, vize ve vaultu)
a vystavuje ho jako strukturovaná data, ze kterých agent (Claude) generuje konkrétní, do reality
zasazené návrhy na nové projekty.

> **Tajnost:** idea banka žije v `ideas.json` (gitignored, práva `0600`). Nápady nejsou v commitech,
> na webu ani nikde veřejně. Server je lokální proces přes stdio — žádný port, žádná expozice do internetu.

## Nástroje

| Nástroj | Popis |
|---|---|
| `list_categories` | kategorie portfolia + projekty v nich |
| `list_stack` | agregace jazyků/technologií s četností |
| `analyze_portfolio` | statistiky + rozložení podle stavu |
| `get_gaps` | domény a technologie, které v portfoliu chybí |
| `list_ideas` | nápady z tajné banky |
| `add_idea` | uloží nápad (title povinný, platform/category/rationale doporučené) |
| `remove_idea` | smaže nápad podle id |

## Resources (procházení v UI)

- `idea-bank://portfolio/katalog`
- `idea-bank://portfolio/status`
- `idea-bank://vision`

## Spuštění

```bash
npm install
npm run dev          # tsx watch
npm run start        # jednorázové spuštění
npm run typecheck
```

## Připojení do Claude Code

Přidej do `.mcp.json` (v `~/projects`) nebo do globální konfigurace MCP:

```json
{
  "mcpServers": {
    "idea-bank": {
      "command": "tsx",
      "args": ["/home/lafe_trap/projects/idea-bank/src/index.ts"]
    }
  }
}
```

## Jak to funguje

1. Agent zavolá `analyze_portfolio` + `get_gaps` + přečte `idea-bank://vision`.
2. Získá reálný stav: co existuje, co je plánované, kde jsou díry.
3. Doporučí konkrétní projekty zasazené do portfolia — ne generický seznam z internetu.
4. Vybrané nápady se uloží přes `add_idea` do tajné banky.
