import fs from 'fs';
import path from 'path';

const agentsToUnmock = [
  { file: 'server/agents/sources/d1/src-ibge-mapbiomas.ts', sites: 'site:mapbiomas.org OR site:ibge.gov.br' },
  { file: 'server/agents/sources/d1/src-fiocruz-clima.ts', sites: 'site:fiocruz.br' },
  { file: 'server/agents/sources/d1/src-mp-ambiental.ts', sites: 'site:mpf.mp.br OR site:mppa.mp.br OR site:mpba.mp.br' },
  { file: 'server/agents/sources/d1/src-cptec-inpe.ts', sites: 'site:cptec.inpe.br OR site:inpe.br' },
  { file: 'server/agents/sources/d4/src-plano-diretor.ts', sites: 'site:gov.br "plano diretor"' },
  { file: 'server/agents/sources/d4/src-geni-uff.ts', sites: 'site:geni.uff.br OR site:uff.br' },
  { file: 'server/agents/sources/d4/src-funai-iphan.ts', sites: 'site:funai.gov.br OR site:iphan.gov.br' },
  { file: 'server/agents/sources/d4/src-isp-ssp.ts', sites: 'site:ispdados.rj.gov.br OR site:ssp.ba.gov.br' },
  { file: 'server/agents/sources/d4/src-judiciario.ts', sites: 'site:cnj.jus.br OR site:tjba.jus.br' },
  { file: 'server/agents/sources/d4/src-unicamp-terr.ts', sites: 'site:unicamp.br' }
];

const template = `  protected async fetchSignals(
    territory: Territory,
    options: CollectOptions
  ): Promise<RawSignal[]> {
    const SERPAPI_KEY = process.env.SERPAPI_API_KEY ?? "";
    if (!SERPAPI_KEY) return [];

    const signals: RawSignal[] = [];
    const query = territory.name;
    const searchString = \`SITES_PLACEHOLDER "\${query}"\`;
    
    const url = \`https://serpapi.com/search.json?engine=google&q=\${encodeURIComponent(searchString)}&num=3&api_key=\${SERPAPI_KEY}\`;

    try {
      const res = await fetch(url, { signal: options.signal });
      if (!res.ok) return [];

      const data = await res.json();
      const results = data.organic_results ?? [];

      for (const item of results) {
        signals.push({
          title: item.title,
          summary: item.snippet,
          url: item.link,
          sourceAgentId: this.id,
          publishedAt: new Date(),
          metadata: { query }
        });
      }
    } catch {
      // ignore
    }

    return signals;
  }`;

for (const agent of agentsToUnmock) {
  const p = path.resolve(agent.file);
  if (!fs.existsSync(p)) continue;

  let content = fs.readFileSync(p, 'utf-8');
  
  // Encontrar onde 'protected async fetchSignals' começa e substituir até o final da classe
  const matchIdx = content.indexOf('protected async fetchSignals');
  if (matchIdx !== -1) {
    const before = content.substring(0, matchIdx);
    const replacement = template.replace('SITES_PLACEHOLDER', agent.sites);
    content = before + replacement + '\n}\n';
    fs.writeFileSync(p, content, 'utf-8');
    console.log(`Unmocked ${agent.file}`);
  }
}
