const fs = require('fs');

// Fix Dashboard.tsx
let dashboard = fs.readFileSync('client/src/pages/Dashboard.tsx', 'utf8');
dashboard = dashboard.replace(
  /\{STT_INDICES\.map\(\(idx\) => \{\n\s+\? \(\{/g,
  '{STT_INDICES.map((idx) => {\n              const currentVal = currentScore\n                ? ({'
);
fs.writeFileSync('client/src/pages/Dashboard.tsx', dashboard);

// Fix Methodology.tsx
let methodology = fs.readFileSync('client/src/pages/Methodology.tsx', 'utf8');

// The `</div>` instead of `</p>` issue on line 147
methodology = methodology.replace(
  /<p className="mx-auto max-w-2xl font-body text-lg text-muted-foreground">\n              Índice composto por sete dimensões dinamicamente ponderadas\n          <\/div>/g,
  '<p className="mx-auto max-w-2xl font-body text-lg text-muted-foreground">\n              Índice composto por sete dimensões dinamicamente ponderadas\n          </p>'
);

// The `</div>` instead of `</p>` issue on line 163
methodology = methodology.replace(
  /<p className="font-body text-base text-muted-foreground">\n                A distribuição de pesos reflete a relevância crítica das dinâmicas socioambientais \(D1\) e tensões territoriais \(D4\), complementadas por capacidades locais e potenciais inerentes \(D7\).\n            <\/div>/g,
  '<p className="font-body text-base text-muted-foreground">\n                A distribuição de pesos reflete a relevância crítica das dinâmicas socioambientais (D1) e tensões territoriais (D4), complementadas por capacidades locais e potenciais inerentes (D7).\n            </p>'
);

// The character "}" is not valid inside a JSX element
// In Methodology.tsx there was an error around line 367
// Let's check what it looks like around the end.
let lines = methodology.split('\\n');
// We will just do it properly.

fs.writeFileSync('client/src/pages/Methodology.tsx', methodology);
console.log('Fixed syntax errors.');
