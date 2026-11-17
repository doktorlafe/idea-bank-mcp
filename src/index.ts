#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';
import { PATHS } from './config.js';
import { parseCatalog, parseStatus } from './parse.js';
import { loadIdeas, addIdea, removeIdea } from './ideas.js';

// ---------------------------------------------------------------------------
// Referenční taxonomie pro gap analýzu („co ti v portfoliu chybí")
// ---------------------------------------------------------------------------

const DOMAINS: { name: string; match: RegExp }[] = [
  { name: 'web / frontend', match: /web|landing|frontend|html|css|react|vue|svelte|spa|static/i },
  { name: 'backend / API', match: /api|backend|gateway|bridge|fastify|express|django|flask|fastapi|server/i },
  { name: 'data / ML / AI', match: /\bml\b|\bai\b|llm|machine|model|deep|neural|inference/i },
  { name: 'bezpečnost', match: /bezpečnost|security|firewall|honeypot|hardening|crypto|hesl|password|vault|ufw|crowdsec|cowrie/i },
  { name: 'DevOps / IaC', match: /docker|kubernetes|k3s|terraform|iac|ansible|infrastruktura|portainer/i },
  { name: 'monitoring / observability', match: /monitor|uptime|alert|observ|grafana|prometheus/i },
  { name: 'média / streaming', match: /media|stream|audio|video|funkwhale|music|podcast|audiobook|teamspeak/i },
  { name: 'databáze / storage / zálohy', match: /database|sql|postgres|mysql|mariadb|mongo|redis|storage|backup|záloh|duplicati|icloud|rclone/i },
  { name: 'automatizace / boti', match: /bot|automati|sync|cron|email|mailer/i },
  { name: 'mobilní aplikace', match: /mobil|android|ios|\bapp\b|pwa/i },
  { name: 'desktop / vzdálený přístup', match: /desktop|webtop|code-server|vzdálen|remote|vpn|wireguard/i },
  { name: 'hry', match: /game|hra|herní|unity|godot/i },
  { name: 'IoT / hardware', match: /iot|hardware|arduino|esp|raspberry|sensor/i },
];

const TECH_GAPS = [
  'Rust', 'Go', 'GraphQL', 'gRPC', 'WebSocket', 'Redis', 'PostgreSQL',
  'MongoDB', 'Elasticsearch', 'Kafka', 'RabbitMQ', 'WebAssembly', 'Svelte',
  'Next.js', 'NestJS', 'Electron', 'React Native', 'Flutter', 'Tauri',
  'Celery', 'Airflow', 'Prometheus', 'Grafana', 'Elixir', 'Zig',
];

// ---------------------------------------------------------------------------
// Pomocné
// ---------------------------------------------------------------------------

function text(value: unknown): { content: { type: 'text'; text: string }[] } {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
}

function readOr(path: string): string | null {
  if (!existsSync(path)) return null;
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

function buildServer(): McpServer {
  const server = new McpServer({
    name: 'idea-bank',
    version: '0.1.0',
  });

  // === Tools: čtení portfolia (materiál pro doporučení) ===================

  server.registerTool(
    'list_categories',
    {
      description:
        'Vrátí kategorie portfolia (z projects.md) s počtem projektů a jejich jmény. ' +
        'Použij, když potřebuješ vědět, co už existuje a v jakých oblastech.',
    },
    async () => {
      const catalog = parseCatalog();
      return text(
        catalog.categories.map((c) => ({
          category: c.title,
          emoji: c.emoji,
          count: c.projects.length,
          projects: c.projects.map((p) => p.name),
        })),
      );
    },
  );

  server.registerTool(
    'list_stack',
    {
      description:
        'Agreguje jazyky/technologie napříč celým portfoliem s počtem výskytů. ' +
        'Použij, abys viděl, co se nejvíc používá a co skoro vůbec.',
    },
    async () => {
      const catalog = parseCatalog();
      const counts = new Map<string, number>();
      for (const c of catalog.categories) {
        for (const p of c.projects) {
          for (const t of p.stack) counts.set(t, (counts.get(t) ?? 0) + 1);
        }
      }
      const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
      return text(Object.fromEntries(sorted));
    },
  );

  server.registerTool(
    'analyze_portfolio',
    {
      description:
        'Vrátí souhrnné statistiky portfolia: počet projektů, kategorie, ' +
        'a rozložení podle stavu (kritické/aktivní/plánované/archiv) ze status.md. ' +
        'Výchozí vstupní bod, když je potřeba doporučit nový projekt.',
    },
    async () => {
      const catalog = parseCatalog();
      const status = parseStatus();
      const total = catalog.categories.reduce((n, c) => n + c.projects.length, 0);
      return text({
        title: catalog.title,
        totalProjects: total,
        categoryCount: catalog.categories.length,
        categories: catalog.categories.map((c) => ({
          name: c.title,
          count: c.projects.length,
        })),
        statusSections: status.sections.map((s) => ({
          title: s.title,
          count: s.projects.length,
          projects: s.projects,
        })),
      });
    },
  );

  server.registerTool(
    'get_gaps',
    {
      description:
        'Najde mezery v portfoliu: domény bez jediného projektu a technologie, ' +
        'které se vůbec nepoužívají. Klíčový nástroj proti tvůrčímu bloku — ' +
        'vrací konkrétní oblasti, kam můžeš portfolium rozšířit.',
    },
    async () => {
      const catalog = parseCatalog();
      const status = parseStatus();

      // Zahrň i plánované/projektované položky ze status.md, aby gap analýza
      // nenavrhovala něco, co už je v to-do (code-server, wireguard, webtop...).
      const catalogText = catalog.categories
        .flatMap((c) => [c.title, ...c.projects.flatMap((p) => [p.name, p.description])])
        .join('\n');
      const statusText = status.sections
        .flatMap((s) => [s.title, ...s.projects])
        .join('\n');
      const allText = `${catalogText}\n${statusText}`;

      const domainsMissing = DOMAINS.filter((d) => !d.match.test(allText)).map((d) => d.name);

      const usedStack = new Set<string>();
      for (const c of catalog.categories) {
        for (const p of c.projects) for (const t of p.stack) usedStack.add(t);
      }
      const techUnused = TECH_GAPS.filter((t) => !usedStack.has(t));

      return text({ domainsMissing, techUnused });
    },
  );

  // === Tools: tajná idea banka (read-write) ===============================

  server.registerTool(
    'list_ideas',
    {
      description:
        'Vypíše všechny nápady uložené v tajné idea bance (ideas.json).',
    },
    async () => text(loadIdeas()),
  );

  server.registerTool(
    'add_idea',
    {
      description:
        'Uloží nový nápad do tajné idea banky. Nápady jsou obecná projektová zadání ' +
        '(ne odvozeniny z portfolia). title je povinný; platform, category, prinos ' +
        'a obtiznost jsou doporučené.',
      inputSchema: z.object({
        title: z.string().describe('Krátký název nápadu'),
        platform: z.string().optional().describe('Jazyk/platforma/stack (např. bash, C#, Python)'),
        category: z
          .string()
          .optional()
          .describe('Typ projektu: databáze, vizualizace dat, monitoring, linux, shell / bash, skriptování, sítě, web, windows / PowerShell, C++ / C#, AI / ML'),
        prinos: z.string().optional().describe('Co se na tom naučíš'),
        obtiznost: z
          .number()
          .int()
          .min(1)
          .max(4)
          .optional()
          .describe('1 = začátečník, 2 = mírně pokročilý, 3 = pokročilý, 4 = expert'),
      }),
    },
    async ({ title, platform, category, prinos, obtiznost }) => {
      const idea = addIdea({
        title,
        platform,
        category,
        prinos,
        obtiznost: obtiznost as 1 | 2 | 3 | 4 | undefined,
      });
      return text({ ok: true, idea });
    },
  );

  server.registerTool(
    'remove_idea',
    {
      description: 'Smaže nápad z tajné idea banky podle id.',
      inputSchema: z.object({
        id: z.string().describe('ID nápadu (uuid)'),
      }),
    },
    async ({ id }) => {
      const ok = removeIdea(id);
      return text({ ok, id });
    },
  );

  // === Resources: procházení v UI =========================================

  const reg = (name: string, uri: string, title: string, path: string) => {
    server.registerResource(name, uri, { title, mimeType: 'text/markdown' }, async (u) => ({
      contents: [{ uri: u.href, text: readOr(path) ?? `# ${title}\n\n(chybí soubor: ${path})` }],
    }));
  };

  reg('portfolio-katalog', 'idea-bank://portfolio/katalog', 'Katalog projektů', PATHS.projectsMd);
  reg('portfolio-status', 'idea-bank://portfolio/status', 'Status projektů', PATHS.statusMd);
  reg('vize', 'idea-bank://vision', 'Centrální vize (vault)', PATHS.visionMd);

  return server;
}

serveStdio(() => buildServer());
