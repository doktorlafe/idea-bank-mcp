import { homedir } from 'node:os';
import { join } from 'node:path';

const HOME = homedir();

/**
 * Cesty ke zdrojovým souborům. Vše lokální, nic se neposílá ven.
 * ideas.json je TAJNÁ — viz .gitignore (nikdy v commitech).
 */
export const PATHS = {
  projectsMd: join(HOME, 'projects', 'projects.md'),
  statusMd: join(HOME, 'projects', 'status.md'),
  visionMd: join(HOME, 'vault', 'AI-CONTROLLER-MEMORY.md'),
  ideasJson: join(HOME, 'projects', 'idea-bank', 'ideas.json'),
} as const;
