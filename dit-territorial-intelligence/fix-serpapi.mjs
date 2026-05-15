import fs from 'fs';
import path from 'path';

const dirs = [
  'server/agents/sources/d1',
  'server/agents/sources/d3',
  'server/agents/sources/d4',
  'server/agents/sources/d6'
];

for (const dir of dirs) {
  if (!fs.existsSync(dir)) continue;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts'));
  for (const f of files) {
    const p = path.join(dir, f);
    let content = fs.readFileSync(p, 'utf-8');
    let changed = false;

    // Remove top-level SERPAPI_KEY definition
    if (content.includes('const SERPAPI_KEY = process.env.SERPAPI_API_KEY')) {
      content = content.replace(/const SERPAPI_KEY = process\.env\.SERPAPI_API_KEY\s*.*\n/g, '');
      changed = true;
    }

    // Inside fetchSignals, ensure SERPAPI_KEY is retrieved
    if (content.includes('serpapi.com/search.json')) {
      if (!content.includes('const SERPAPI_KEY = process.env.SERPAPI_API_KEY')) {
         const fetchStart = content.indexOf('protected async fetchSignals');
         if (fetchStart !== -1) {
            const bodyStart = content.indexOf('{', fetchStart);
            if (bodyStart !== -1) {
                const insert = '\n    const SERPAPI_KEY = process.env.SERPAPI_API_KEY ?? "";\n    if (!SERPAPI_KEY) return [];\n';
                content = content.slice(0, bodyStart + 1) + insert + content.slice(bodyStart + 1);
                changed = true;
            }
         }
      }
      
      // Ensure tbs is used
      if (!content.includes('tbs =')) {
          const urlMatch = content.match(/const url = `https:\/\/serpapi\.com\/search\.json\?engine=google&q=\$\{encodeURIComponent\(searchString\)\}&num=3&api_key=\$\{SERPAPI_KEY\}`;/);
          if (urlMatch) {
              const replacement = `let tbs = "";
    if (options.dateStart && options.dateEnd) {
      tbs = \`&tbs=cdr:1,cd_min:\${options.dateStart},cd_max:\${options.dateEnd}\`;
    }
    const url = \`https://serpapi.com/search.json?engine=google&q=\${encodeURIComponent(searchString)}&num=3\${tbs}&api_key=\${SERPAPI_KEY}\`;`;
              content = content.replace(urlMatch[0], replacement);
              changed = true;
          } else {
              // Try another variant without braces if already fixed by powershell
               const urlMatch2 = content.match(/const url = `https:\/\/serpapi\.com\/search\.json\?engine=google&q=\$\{encodeURIComponent\(searchString\)\}&num=3&api_key=\$SERPAPI_KEY`;/);
               if (urlMatch2) {
                   const replacement = `let tbs = "";
    if (options.dateStart && options.dateEnd) {
      tbs = \`&tbs=cdr:1,cd_min:\${options.dateStart},cd_max:\${options.dateEnd}\`;
    }
    const url = \`https://serpapi.com/search.json?engine=google&q=\${encodeURIComponent(searchString)}&num=3\${tbs}&api_key=\${SERPAPI_KEY}\`;`;
                  content = content.replace(urlMatch2[0], replacement);
                  changed = true;
               }
          }
      }
    }

    if (changed) {
      fs.writeFileSync(p, content, 'utf-8');
      console.log(`Fixed ${p}`);
    }
  }
}
