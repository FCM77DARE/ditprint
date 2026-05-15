const fs = require('fs');

function refactorFile(path) {
  let content = fs.readFileSync(path, 'utf8');

  // Replace Types and Interfaces
  content = content.replace(/calculatedItt: (number|\{ type: "number" \});/g, 'calculatedD1: $1;');
  content = content.replace(/calculatedIcs: (number|\{ type: "number" \});/g, 'calculatedD2: $1;');
  content = content.replace(/calculatedIvs: (number|\{ type: "number" \});/g, 'calculatedD3: $1;');
  content = content.replace(/calculatedIve: (number|\{ type: "number" \});/g, 'calculatedD4: $1;');
  content = content.replace(/calculatedIci: (number|\{ type: "number" \});/g, 'calculatedD5: $1;\n  calculatedD6: $1;\n  calculatedD7: $1;');

  // Replace JSON Schema require array
  content = content.replace(/"calculatedItt", "calculatedIcs", "calculatedIvs", "calculatedIve", "calculatedIci"/g, '"calculatedD1", "calculatedD2", "calculatedD3", "calculatedD4", "calculatedD5", "calculatedD6", "calculatedD7"');

  // Replace clamp and assignment logic
  content = content.replace(/const itt  = clampScore\(result\.calculatedItt\);/g, 'const d1  = clampScore(result.calculatedD1);');
  content = content.replace(/const ics  = clampScore\(result\.calculatedIcs\);/g, 'const d2  = clampScore(result.calculatedD2);');
  content = content.replace(/const ivs  = clampScore\(result\.calculatedIvs\);/g, 'const d3  = clampScore(result.calculatedD3);');
  content = content.replace(/const ive  = clampScore\(result\.calculatedIve\);/g, 'const d4  = clampScore(result.calculatedD4);');
  content = content.replace(/const ici  = clampScore\(result\.calculatedIci\);/g, 'const d5  = clampScore(result.calculatedD5);\n  const d6  = clampScore(result.calculatedD6);\n  const d7  = clampScore(result.calculatedD7);');

  // Replace calculatedItt: itt, return object
  content = content.replace(/calculatedItt: itt,/g, 'calculatedD1: d1,');
  content = content.replace(/calculatedIcs: ics,/g, 'calculatedD2: d2,');
  content = content.replace(/calculatedIvs: ivs,/g, 'calculatedD3: d3,');
  content = content.replace(/calculatedIve: ive,/g, 'calculatedD4: d4,');
  content = content.replace(/calculatedIci: ici,/g, 'calculatedD5: d5,\n    calculatedD6: d6,\n    calculatedD7: d7,');

  // Replace historicalCollector itt: assignment
  content = content.replace(/itt: Math\.round\(result\.calculatedItt \* 10\) \/ 10,/g, 'd1Score: Math.round(result.calculatedD1 * 10) / 10,');
  content = content.replace(/ics: Math\.round\(result\.calculatedIcs \* 10\) \/ 10,/g, 'd2Score: Math.round(result.calculatedD2 * 10) / 10,');
  content = content.replace(/ivs: Math\.round\(result\.calculatedIvs \* 10\) \/ 10,/g, 'd3Score: Math.round(result.calculatedD3 * 10) / 10,');
  content = content.replace(/ive: Math\.round\(result\.calculatedIve \* 10\) \/ 10,/g, 'd4Score: Math.round(result.calculatedD4 * 10) / 10,');
  content = content.replace(/ici: Math\.round\(result\.calculatedIci \* 10\) \/ 10,/g, 'd5Score: Math.round(result.calculatedD5 * 10) / 10,\n          d6Score: Math.round(result.calculatedD6 * 10) / 10,\n          d7Score: Math.round(result.calculatedD7 * 10) / 10,');

  // Replace STT formula in LLM prompts
  content = content.replace(/STT = \(ITT\*25%\) \+ \(ICS\*20%\) \+ \(IVS\*20%\) \+ \(IVE\*20%\) \+ \(ICI\*15%\)/g, 'STT = (D1*20%) + (D2*14%) + (D3*14%) + (D4*20%) + (D5*12%) + (D6*10%) + (D7*10%)');
  content = content.replace(/ITT, ICS, IVS, IVE, ICI/g, 'D1, D2, D3, D4, D5, D6, D7');

  fs.writeFileSync(path, content);
}

refactorFile('server/collector.ts');
refactorFile('server/historicalCollector.ts');
console.log('Done refactoring collectors.');
