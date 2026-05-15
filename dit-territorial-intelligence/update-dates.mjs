import fs from 'fs';
import path from 'path';

const dirs = [
  'server/agents/sources/d1',
  'server/agents/sources/d3',
  'server/agents/sources/d4'
];

for (const dir of dirs) {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts'));
  for (const f of files) {
    const p = path.join(dir, f);
    let content = fs.readFileSync(p, 'utf-8');
    
    if (content.includes('serpapi.com/search.json')) {
      if (!content.includes('tbs=')) {
        // Find the line defining the url
        const match = content.match(/const url = `https:\/\/serpapi\.com\/search\.json\?engine=google&q=\$\{encodeURIComponent\(searchString\)}&num=3&api_key=\$\{SERPAPI_KEY\}`;/);
        
        if (match) {
          const replacement = `let tbs = "";
    if (options.dateStart && options.dateEnd) {
      tbs = \`&tbs=cdr:1,cd_min:\${options.dateStart},cd_max:\${options.dateEnd}\`;
    }
    const url = \`https://serpapi.com/search.json?engine=google&q=\${encodeURIComponent(searchString)}&num=3\${tbs}&api_key=\${SERPAPI_KEY}\`;`;
          
          content = content.replace(match[0], replacement);
          fs.writeFileSync(p, content, 'utf-8');
          console.log(`Updated ${p} to support dates`);
        }
      }
    }
  }
}
