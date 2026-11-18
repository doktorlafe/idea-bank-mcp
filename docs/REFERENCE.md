# idea-bank — technical reference

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

| Mode | Exposure |
|---|---|
| **Local** (`npx idea-bank`, stdio) | No network port, no internet. Reads only your local catalog/status/vision files. Your bank (`ideas.json`, `0600`) never leaves your machine and is never committed. |
| **Hosted** (`https://mcp.laferrari.eu/mcp`) | Read-only. Only `recommend_idea` (max 2 ideas per call) and `list_idea_categories`. No portfolio tools, no resources, no write tools. Rate limited per IP (60 requests / 10 min). |

## Self-hosting the HTTP server

```bash
docker compose up -d --build     # listens on 127.0.0.1:8787, put a reverse proxy in front
```

| Variable | Default |
|---|---|
| `PORT` / `HOST` | `8787` / `127.0.0.1` (`0.0.0.0` in Docker) |
| `RATE_LIMIT` / `RATE_WINDOW_SEC` | `60` / `600` |
| `IDEA_BANK_IDEAS_JSON` | mounted read-only at `/data/ideas.json` |

Proxy must not buffer responses (Caddy: `flush_interval -1`).
