import { homedir } from 'node:os';
import { join } from 'node:path';

const HOME = homedir();

/**
 * Cesty ke zdrojovým souborům. Vše lokální, nic se neposílá ven.
 *
 * Výchozí cesty vycházejí z home adresáře (osobní použití). Pro jiné
 * uživatele / vlastní rozložení lze každou cestu přepsat proměnnou
 * prostředí — viz `IDEA_BANK_*` níže.
 *
 * `ideas.json` je TAJNÁ — viz .gitignore (nikdy v commitech).
 */
function envPath(key: string, fallback: string): string {
  return process.env[key]?.trim() || fallback;
}

export const PATHS = {
  /** katalog projektů (projects.md) */
  projectsMd: envPath('IDEA_BANK_PROJECTS_MD', join(HOME, 'projects', 'projects.md')),
  /** status projektů (status.md) */
  statusMd: envPath('IDEA_BANK_STATUS_MD', join(HOME, 'projects', 'status.md')),
  /** centrální vize (vault) */
  visionMd: envPath('IDEA_BANK_VISION_MD', join(HOME, 'vault', 'AI-CONTROLLER-MEMORY.md')),
  /** tajná idea banka */
  ideasJson: envPath('IDEA_BANK_IDEAS_JSON', join(HOME, 'projects', 'idea-bank', 'ideas.json')),
} as const;

/** Názvy proměnných prostředí, které přepisují cesty (pro dokumentaci). */
export const PATH_ENV_VARS = {
  projectsMd: 'IDEA_BANK_PROJECTS_MD',
  statusMd: 'IDEA_BANK_STATUS_MD',
  visionMd: 'IDEA_BANK_VISION_MD',
  ideasJson: 'IDEA_BANK_IDEAS_JSON',
} as const;
