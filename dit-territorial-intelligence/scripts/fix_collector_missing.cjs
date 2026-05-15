const fs = require('fs');

let code = fs.readFileSync('server/collector.ts', 'utf8');

const missingBlock = `              type: "object",
                properties: {
                  id: { type: "integer" },
                  index: { type: "string" },
                  impactScore: { type: "number" },
                  analysis: { type: "string" },
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
  });

  const rawContent = response.choices?.[0]?.message?.content;
  if (!rawContent) throw new Error("LLM returned empty response");
  const content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);`;

code = code.replace(
  /type: "array",\s*items: \{\s*const result = JSON\.parse\(content\) as \{/,
  'type: "array",\n              items: {\n  ' + missingBlock + '\n\n  const result = JSON.parse(content) as {'
);

fs.writeFileSync('server/collector.ts', code);
console.log('Fixed collector.ts');
