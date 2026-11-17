import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { PATHS } from './config.js';

export interface Idea {
  id: string;
  title: string;
  /** jazyk / platforma / stack doporučený pro nápad */
  platform: string;
  /** doména, do které nápad spadá (web, AI, bezpečnost, ...) */
  category: string;
  /** proč to dává smysl právě v tomto portfoliu */
  rationale: string;
  createdAt: string;
}

export interface IdeaInput {
  title: string;
  platform?: string;
  category?: string;
  rationale?: string;
}

/** Načte celou banku. Neexistující / poškozený soubor → prázdné pole. */
export function loadIdeas(): Idea[] {
  if (!existsSync(PATHS.ideasJson)) return [];
  try {
    return JSON.parse(readFileSync(PATHS.ideasJson, 'utf8')) as Idea[];
  } catch {
    return [];
  }
}

/** Uloží banku atomicky s přísnými právy (0600) — je tajná. */
function saveIdeas(ideas: Idea[]): void {
  mkdirSync(dirname(PATHS.ideasJson), { recursive: true });
  writeFileSync(PATHS.ideasJson, JSON.stringify(ideas, null, 2) + '\n', {
    encoding: 'utf8',
    mode: 0o600,
  });
}

export function addIdea(input: IdeaInput): Idea {
  const ideas = loadIdeas();
  const idea: Idea = {
    id: randomUUID(),
    title: input.title,
    platform: input.platform ?? '',
    category: input.category ?? '',
    rationale: input.rationale ?? '',
    createdAt: new Date().toISOString(),
  };
  ideas.push(idea);
  saveIdeas(ideas);
  return idea;
}

export function removeIdea(id: string): boolean {
  const ideas = loadIdeas();
  const next = ideas.filter((i) => i.id !== id);
  if (next.length === ideas.length) return false;
  saveIdeas(next);
  return true;
}
