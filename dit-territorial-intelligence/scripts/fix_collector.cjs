const fs = require('fs');

let content = fs.readFileSync('server/collector.ts', 'utf8');

// Fix JSON schema
content = content.replace(
`                  analysis: { type: "string" },
          additionalProperties: false,
        },
      },
      additionalProperties: false,
    },
  });`,
`                  analysis: { type: "string" },
                },
                required: ["id", "index", "impactScore", "analysis"],
                additionalProperties: false,
              },
            },
            calculatedD1: { type: "number" },
            calculatedD2: { type: "number" },
            calculatedD3: { type: "number" },
            calculatedD4: { type: "number" },
            calculatedD5: { type: "number" },
            calculatedD6: { type: "number" },
            calculatedD7: { type: "number" },
            calculatedStt: { type: "number" },
            activatedIndex: { type: "string" },
            scenario: { type: "string" },
            executiveNote: { type: "string" },
          },
          required: ["signals", "calculatedD1", "calculatedD2", "calculatedD3", "calculatedD4", "calculatedD5", "calculatedD6", "calculatedD7", "calculatedStt", "activatedIndex", "scenario", "executiveNote"],
          additionalProperties: false,
        },
      },
    },
  });`
);

// Fix insertIndexHistory inside collector.ts
content = content.replace(
`    stt,
    itt,
    ics,
    ivs,
    ive,
    ici,
    sttDelta: variation,
    ittDelta: prevHistory ? parseFloat((itt - (prevHistory.itt ?? 0)).toFixed(1)) : 0,
    icsDelta: prevHistory ? parseFloat((ics - (prevHistory.ics ?? 0)).toFixed(1)) : 0,
    ivsDelta: prevHistory ? parseFloat((ivs - (prevHistory.ivs ?? 0)).toFixed(1)) : 0,
    iveDelta: prevHistory ? parseFloat((ive - (prevHistory.ive ?? 0)).toFixed(1)) : 0,
    iciDelta: prevHistory ? parseFloat((ici - (prevHistory.ici ?? 0)).toFixed(1)) : 0,`,
`    stt,
    d1Score: d1,
    d2Score: d2,
    d3Score: d3,
    d4Score: d4,
    d5Score: d5,
    d6Score: d6,
    d7Score: d7,
    sttDelta: variation,
    d1Delta: prevHistory ? parseFloat((d1 - (prevHistory.d1Score ?? 0)).toFixed(1)) : 0,
    d2Delta: prevHistory ? parseFloat((d2 - (prevHistory.d2Score ?? 0)).toFixed(1)) : 0,
    d3Delta: prevHistory ? parseFloat((d3 - (prevHistory.d3Score ?? 0)).toFixed(1)) : 0,
    d4Delta: prevHistory ? parseFloat((d4 - (prevHistory.d4Score ?? 0)).toFixed(1)) : 0,
    d5Delta: prevHistory ? parseFloat((d5 - (prevHistory.d5Score ?? 0)).toFixed(1)) : 0,
    d6Delta: prevHistory ? parseFloat((d6 - (prevHistory.d6Score ?? 0)).toFixed(1)) : 0,
    d7Delta: prevHistory ? parseFloat((d7 - (prevHistory.d7Score ?? 0)).toFixed(1)) : 0,`
);

// Also need to check if we missed defining d1,d2,d3,d4,d5,d6,d7 in historicalCollector
let hContent = fs.readFileSync('server/historicalCollector.ts', 'utf8');
hContent = hContent.replace(
`          stt,
          itt,
          ics,
          ivs,
          ive,
          ici,`,
`          stt,
          d1Score: Math.round(result.calculatedD1 * 10) / 10,
          d2Score: Math.round(result.calculatedD2 * 10) / 10,
          d3Score: Math.round(result.calculatedD3 * 10) / 10,
          d4Score: Math.round(result.calculatedD4 * 10) / 10,
          d5Score: Math.round(result.calculatedD5 * 10) / 10,
          d6Score: Math.round(result.calculatedD6 * 10) / 10,
          d7Score: Math.round(result.calculatedD7 * 10) / 10,`
);
hContent = hContent.replace(
`    sttDelta: 0,
    ittDelta: 0,
    icsDelta: 0,
    ivsDelta: 0,
    iveDelta: 0,
    iciDelta: 0,`,
`    sttDelta: 0,
    d1Delta: 0,
    d2Delta: 0,
    d3Delta: 0,
    d4Delta: 0,
    d5Delta: 0,
    d6Delta: 0,
    d7Delta: 0,`
);

fs.writeFileSync('server/collector.ts', content);
fs.writeFileSync('server/historicalCollector.ts', hContent);
console.log('Fixed collector schemas and db calls.');
