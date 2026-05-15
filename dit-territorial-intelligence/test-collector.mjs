// Script de teste do dataCollector
// Executa: node --import tsx/esm test-collector.mjs
import { runStructuredDataPipeline } from './server/dataCollector.ts';

console.log('Iniciando teste do dataCollector...');
const results = await runStructuredDataPipeline('baia-guanabara');
console.log('Resultado:', JSON.stringify(results, null, 2));
