import { randomInt } from 'node:crypto';
import type { Idea } from './ideas.js';

/**
 * Veřejná podoba nápadu — bez interních polí (id, createdAt).
 * Ven nikdy nejde celá banka, jen pár vybraných nápadů na dotaz.
 */
export interface PublicIdea {
  title: string;
  platform: string;
  category: string;
  prinos: string;
  obtiznost: number;
}

export interface RecommendQuery {
  /** volný text: co člověk umí / co ho láká (např. "bash docker, chci zkusit Rust") */
  zajmy?: string;
  /** maximální obtížnost 1–4 */
  maxObtiznost?: number;
  /** preferovaná kategorie (podřetězec, bez ohledu na velikost písmen) */
  kategorie?: string;
}

/** Kolik nápadů nejvýš vrátí jeden dotaz. Drží banku „zamčenou". */
export const MAX_PER_QUERY = 2;

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^\p{L}\p{N}+#.]+/u)
    .filter((t) => t.length >= 2);
}

function toPublic(i: Idea): PublicIdea {
  return {
    title: i.title,
    platform: i.platform,
    category: i.category,
    prinos: i.prinos,
    obtiznost: i.obtiznost,
  };
}

/**
 * Vybere nejvýš MAX_PER_QUERY nápadů podle shody se zájmy.
 * Při shodném skóre rozhoduje náhoda, aby opakované dotazy nevracely
 * deterministicky stejné pořadí (a nešlo tak snadno „projet" banku).
 */
export function recommend(ideas: Idea[], q: RecommendQuery): PublicIdea[] {
  const want = tokens(q.zajmy ?? '');
  const cat = q.kategorie?.trim().toLowerCase();
  const max = q.maxObtiznost ?? 4;

  const scored = ideas
    .filter((i) => i.obtiznost <= max)
    .filter((i) => !cat || i.category.toLowerCase().includes(cat))
    .map((i) => {
      const hay = `${i.title} ${i.platform} ${i.category} ${i.prinos}`.toLowerCase();
      const score = want.reduce((n, t) => n + (hay.includes(t) ? 1 : 0), 0);
      return { i, score, tie: randomInt(1_000_000) };
    });

  // Když zadal zájmy a něco sedí, ber jen shody; jinak náhodný výběr.
  const pool = want.length && scored.some((s) => s.score > 0) ? scored.filter((s) => s.score > 0) : scored;

  return pool
    .sort((a, b) => b.score - a.score || a.tie - b.tie)
    .slice(0, MAX_PER_QUERY)
    .map((s) => toPublic(s.i));
}

/** Jen názvy kategorií a počty — žádné tituly. Pomáhá vést dialog. */
export function categorySummary(ideas: Idea[]): { category: string; count: number }[] {
  const m = new Map<string, number>();
  for (const i of ideas) {
    const c = i.category || 'ostatní';
    m.set(c, (m.get(c) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([category, count]) => ({ category, count }));
}
