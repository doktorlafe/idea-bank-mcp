import { readFileSync } from 'node:fs';
import { PATHS } from './config.js';

export interface Project {
  name: string;
  description: string;
  stack: string[];
}

export interface Category {
  /** syrový titulek sekce, např. "🌐 Weby" */
  title: string;
  /** emoji z titulku, např. "🌐" (pokud je) */
  emoji: string;
  projects: Project[];
}

export interface Catalog {
  title: string;
  categories: Category[];
}

export interface StatusSection {
  title: string;
  projects: string[];
}

export interface Status {
  title: string;
  sections: StatusSection[];
}

// ---------------------------------------------------------------------------
// Nízkoúrovňové pomocné funkce
// ---------------------------------------------------------------------------

/** Rozdělí řádek tabulky `| a | b |` na očištěné buňky. */
function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((s) => s.trim());
}

/** Je řádek oddělovač tabulky (`|---|`)? */
function isSeparator(line: string): boolean {
  return /^\s*\|[\s\-:|]+\|\s*$/.test(line);
}

/** Vyčistí jméno projektu: `**name**`, `name`, 🗄️ emoji a backticky. */
function cleanName(raw: string): string {
  return raw
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/^[^\p{L}\p{N}#@]+\s*/u, '') // odtrhni úvodní emoji/ikony
    .trim();
}

// Známé technologie pro detekci stacku z popisu (pro sekce bez sloupce Stack).
// Seznam je záměrně široký — je to heuristika pro doporučování, ne přesná analýza.
const TECH_KEYWORDS = [
  'React', 'Vue', 'Svelte', 'Angular', 'Next.js', 'Nuxt', 'Astro', 'Vite',
  'Tailwind', 'Framer Motion', 'TypeScript', 'JavaScript', 'Node.js', 'Node',
  'Deno', 'Bun', 'Python', 'Golang', 'Rust', 'PHP', 'Ruby', 'Java', 'C#',
  'HTML', 'CSS', 'Caddy', 'Nginx', 'Traefik', 'Postfix', 'Docker',
  'Kubernetes', 'K3s', 'Terraform', 'Ansible', 'rclone', 'icloudpy',
  'SQLite', 'PostgreSQL', 'MySQL', 'MariaDB', 'MongoDB', 'Redis',
  'FastAPI', 'Flask', 'Django', 'Fastify', 'Express', 'NestJS', 'Spring Boot',
  'Laravel', 'Rails', 'GraphQL', 'gRPC', 'WebSocket', 'Chart.js',
  'Cowrie', 'CrowdSec', 'fail2ban', 'UFW', 'Vaultwarden', 'Bitwarden',
  'OpenAI', 'Anthropic', 'DeepSeek', 'Gemini', 'Groq', 'LLM', 'LangChain',
  'LlamaIndex', 'TeamSpeak', 'Funkwhale', 'Uptime Kuma', 'Portainer', 'Gitea',
];

function extractStack(stackCell: string, description: string): string[] {
  const found = new Set<string>();

  // 1) explicitní sloupec Stack (rozděl čárkou)
  for (const token of stackCell.split(',')) {
    const t = token.trim();
    if (t) found.add(t);
  }

  // 2) detekce klíčových slov z popisu (jen když nebyl explicitní stack)
  const hay = `${stackCell} ${description}`;
  for (const kw of TECH_KEYWORDS) {
    if (hay.toLowerCase().includes(kw.toLowerCase())) found.add(kw);
  }

  return [...found];
}

// ---------------------------------------------------------------------------
// Parsery
// ---------------------------------------------------------------------------

/** Načte projects.md a rozdělí ho na kategorie (## sekce) + projekty. */
export function parseCatalog(path = PATHS.projectsMd): Catalog {
  const text = readFileSync(path, 'utf8');
  const lines = text.split('\n');

  const title = lines.find((l) => l.startsWith('# '))?.replace(/^#\s*/, '').trim() ?? '';

  interface Working extends Category {
    _tableLines: string[];
  }

  const categories: Working[] = [];
  let current: Working | null = null;

  const flush = () => {
    if (current) categories.push(current);
    current = null;
  };

  for (const line of lines) {
    if (line.startsWith('## ')) {
      flush();
      const rawTitle = line.replace(/^##\s*/, '').trim();
      const emojiMatch = rawTitle.match(/^(\p{Extended_Pictographic})/u);
      current = {
        title: rawTitle,
        emoji: emojiMatch ? emojiMatch[1] : '',
        projects: [],
        _tableLines: [],
      };
      continue;
    }

    // sbírej řádky tabulky pro aktuální kategorii
    if (current && line.trimStart().startsWith('|')) {
      current._tableLines.push(line);
    }
  }
  flush();

  // zpracuj tabulky pro každou kategorii
  for (const cat of categories) {
    const tableLines = cat._tableLines;

    const dataLines = tableLines.filter((l) => !isSeparator(l));
    if (dataLines.length < 2) continue; // bez hlavičky + dat → žádná tabulka

    const headers = splitRow(dataLines[0]);
    const rows = dataLines.slice(1).map(splitRow);

    const idxOf = (needle: string) =>
      headers.findIndex((h) => h.toLowerCase().includes(needle));
    const nameIdx = idxOf('projekt');
    const descIdx = idxOf('popis');
    const stackIdx = idxOf('stack');

    for (const row of rows) {
      const name = cleanName(row[nameIdx] ?? '');
      if (!name) continue;
      const description = row[descIdx] ?? '';
      const stackCell = stackIdx >= 0 ? (row[stackIdx] ?? '') : '';
      cat.projects.push({
        name,
        description,
        stack: extractStack(stackCell, description),
      });
    }
  }

  return { title, categories: categories.filter((c) => c.projects.length > 0) };
}

/** Načte status.md a rozdělí ho na sekce (🔴 kritické, 🟢 plánované, TODO...). */
export function parseStatus(path = PATHS.statusMd): Status {
  const text = readFileSync(path, 'utf8');
  const lines = text.split('\n');

  const title = lines.find((l) => l.startsWith('# '))?.replace(/^#\s*/, '').trim() ?? '';

  const sections: StatusSection[] = [];
  let current: StatusSection | null = null;

  const flush = () => {
    if (current) sections.push(current);
    current = null;
  };

  for (const line of lines) {
    if (line.startsWith('## ')) {
      flush();
      current = { title: line.replace(/^##\s*/, '').trim(), projects: [] };
      continue;
    }
    if (!current) continue;

    // řádky tabulky → jména projektů (sloupec "projekt")
    if (line.trimStart().startsWith('|')) {
      const cells = splitRow(line);
      // hledej buňku, která vypadá jako jméno projektu (backticky / lomítko / pomlčka)
      for (const cell of cells) {
        const c = cell.trim();
        if (!c || isSeparator(line)) continue;
        if (/^[\d#a-z]*$/.test(c.replace(/[b\d# ]/g, ''))) continue; // přeskoč číslování
        if (c.startsWith('`') || /^[\p{L}\p{N}._-]+$/u.test(c)) {
          const name = cleanName(c);
          if (name && !current.projects.includes(name)) current.projects.push(name);
        }
      }
      continue;
    }

    // TODO položky `- [ ] \`linuxserver/code-server\` — popis`
    const todo = line.match(/^\s*-\s*\[[ xX]?\]\s+`([^`]+)`/);
    if (todo && current.title.toLowerCase().includes('todo')) {
      if (!current.projects.includes(todo[1])) current.projects.push(todo[1]);
    }
  }
  flush();

  return { title, sections: sections.filter((s) => s.projects.length > 0) };
}
