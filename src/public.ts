import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { loadIdeas } from './ideas.js';
import { recommend, categorySummary, MAX_PER_QUERY } from './recommend.js';

/**
 * VEŘEJNÝ server (HTTP). Záměrně omezený povrch:
 *  - žádné čtení portfolia autora (projects.md, status.md, vault) — prozrazovalo by infrastrukturu,
 *  - žádné list_ideas / add_idea / remove_idea — banka je zamčená, ven jdou jen
 *    jednotlivá doporučení (max MAX_PER_QUERY na dotaz),
 *  - žádné resources.
 */
export function buildPublicServer(): McpServer {
  const server = new McpServer({ name: 'idea-bank', version: '0.2.0' });

  const json = (v: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(v, null, 2) }] });

  server.registerTool(
    'recommend_idea',
    {
      description:
        `Doporučí nejvýš ${MAX_PER_QUERY} projektové nápady z kurátorované idea banky ` +
        'na míru uživateli. Nejdřív se s uživatelem pobav: co umí, co ho láká, kolik má času ' +
        'a jak těžké to chce. Pak zavolej tento nástroj. Nápady ber jako odrazový můstek ' +
        'pro dialog a přizpůsob je uživateli; nevypisuj je jako hotový seznam.',
      inputSchema: z.object({
        zajmy: z
          .string()
          .max(500)
          .optional()
          .describe('Co uživatel umí a co ho láká, volným textem (technologie, oblasti, cíle)'),
        maxObtiznost: z
          .number()
          .int()
          .min(1)
          .max(4)
          .optional()
          .describe('Max. obtížnost: 1 = začátečník, 2 = mírně pokročilý, 3 = pokročilý, 4 = expert'),
        kategorie: z.string().max(60).optional().describe('Preferovaná kategorie (viz list_idea_categories)'),
      }),
    },
    async (q) => {
      const ideas = recommend(loadIdeas(), q);
      return json(ideas.length ? { ideas } : { ideas: [], note: 'Nic neodpovídá — zkus volnější kritéria.' });
    },
  );

  server.registerTool(
    'list_idea_categories',
    {
      description:
        'Vrátí kategorie v idea bance a kolik nápadů v každé je (bez názvů nápadů). ' +
        'Hodí se na začátek dialogu, aby uživatel věděl, z čeho se dá vybírat.',
    },
    async () => json(categorySummary(loadIdeas())),
  );

  return server;
}
