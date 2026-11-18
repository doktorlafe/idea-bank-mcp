# idea-bank

An MCP server that helps you beat creative block — not by handing you a list of ideas,
but by giving your AI agent the context to propose *your* next project.

> The server doesn't give answers. It gives material for a conversation.

---

## What it does

Two things, working together:

1. **A secret idea bank** — store project ideas (categorized, with difficulty levels),
   and pull them out whenever you're stuck.
2. **Portfolio gap analysis** — point it at a catalog of your existing projects and it
   tells you which domains and technologies you're *not* using yet.

The recommendation itself happens in the conversation: the agent reads your portfolio,
finds the gaps, and proposes concrete projects — grounded in what you already have,
not a generic list scraped from the internet.

---

## Quick start

```bash
npx idea-bank
```

Or install globally:

```bash
npm install -g idea-bank
```

## Hosted public version (no install)

A public, read-only instance runs at **`https://mcp.laferrari.eu/mcp`** (Streamable HTTP).
In claude.ai: *Settings → Connectors → Add custom connector* → paste the URL.

The public instance exposes only two tools, and the curated bank stays locked:

- `recommend_idea` — returns at most 2 ideas matched to what you know and want (`zajmy`, `maxObtiznost`, `kategorie`)
- `list_idea_categories` — category names and counts only

No portfolio tools, no `list_ideas` / `add_idea` / `remove_idea`, no resources. Rate limited per IP (60 requests / 10 min).
Self-host it yourself with `docker compose up -d --build` (see `Dockerfile`, `compose.yml`).

## Connect to Claude Code

As a plugin (recommended):

```
/plugin install idea-bank --marketplace https://github.com/doktorlafe/idea-bank.git
```

Or manually as an MCP server:

Add the server to your MCP config (`~/.claude.json` for all projects, or `.mcp.json`
for a single project):

```json
{
  "mcpServers": {
    "idea-bank": {
      "command": "npx",
      "args": ["-y", "idea-bank"]
    }
  }
}
```

```bash
claude mcp add idea-bank -- npx -y idea-bank
```

Restart Claude Code — MCP tools load at startup.

---

## Using it

You don't call the tools by hand. Just say:

> "I don't know what to build."

The agent pulls the context and proposes projects. For a more specific answer:

> "What could I build in Rust?"
> "What gaps does my portfolio have?"
> "Which technologies do I use the most?"

To save an idea:

> "Save that to the bank."

---

## Tools

### Reading the portfolio — context for recommendations

| Tool | Returns |
|---|---|
| `list_categories` | portfolio categories with project counts and names |
| `list_stack` | languages and technologies ranked by usage |
| `analyze_portfolio` | stats: project count, categories, breakdown by status |
| `get_gaps` | domains with no project + technologies never used |

`get_gaps` also considers *planned* projects, so it won't suggest something
you already have on your to-do list.

### The secret idea bank — read/write

| Tool | Does |
|---|---|
| `list_ideas` | lists saved ideas |
| `add_idea` | saves an idea (`title` required; `platform`, `category`, `prinos`, `obtiznost` recommended) |
| `remove_idea` | removes an idea by `id` |

### Idea shape

Ideas are general project briefs, independent of any specific portfolio.

| Field | Meaning |
|---|---|
| `title` | the brief (e.g. "Set up Nginx in Docker") |
| `platform` | language / stack (bash, C#, Python, PowerShell…) |
| `category` | project type (see taxonomy below) |
| `prinos` | what you'll learn from it |
| `obtiznost` | difficulty 1–4 |

**Difficulty:**

| Level | Name | Scope |
|---|---|---|
| 1 | Beginner | 1–2 h, one tool |
| 2 | Intermediate | a weekend, 2–3 components |
| 3 | Advanced | a week+, architecture, multiple services |
| 4 | Expert | a month, custom implementation, performance, security |

**Categories:**

`database` · `data visualization` · `monitoring` · `linux` · `shell / bash` ·
`scripting` · `networking` · `web` · `windows / PowerShell` · `C++ / C#` · `AI / ML`

---

## Resources

| URI | Content |
|---|---|
| `idea-bank://portfolio/catalog` | the project catalog |
| `idea-bank://portfolio/status` | project status |
| `idea-bank://vision` | a central vision / goals file |

---

## Configuration

Source file paths default to `~/projects/...`. Override them with environment
variables to point anywhere:

| Variable | Default |
|---|---|
| `IDEA_BANK_PROJECTS_MD` | `~/projects/projects.md` |
| `IDEA_BANK_STATUS_MD` | `~/projects/status.md` |
| `IDEA_BANK_VISION_MD` | `~/vault/AI-CONTROLLER-MEMORY.md` |
| `IDEA_BANK_IDEAS_JSON` | `~/projects/idea-bank/ideas.json` |

```bash
IDEA_BANK_PROJECTS_MD=/data/catalog.md node dist/index.js
```

A missing file never crashes the server — it returns an empty catalog/status.

---

## Privacy & security

| Property | How |
|---|---|
| Ideas stay private | `ideas.json` is local, `0600`, never committed |
| No open port | stdio transport — a child process, not a network service |
| No internet | reads local files only, no network calls |
| No secrets read | only catalog, status, and vision files |

> A DNS record or reverse proxy won't help this server — it has no network interface.
> Remote access would require rewriting the transport to HTTP/SSE and adding auth.

---

## Why it works this way

The bank is **not** derived from the portfolio. If the server handed you a finished
list of ideas, you'd have no reason to open it again. The value is in the process —
context → conversation → your judgment → the bank. The portfolio and gap analysis are
*material for thinking*, not a generator of bank contents.

---

## License

[MIT](./LICENSE)
