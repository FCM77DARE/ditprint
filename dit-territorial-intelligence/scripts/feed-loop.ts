/**
 * Feed Loop
 * 
 * Este script roda a cada 10 minutos (600,000 ms) para povoar o banco
 * de dados com sinais recentes de fontes configuradas (Google RSS, NewsAPI),
 * além de coletar dados estruturados (IBAMA, IBGE, INPE, ANA),
 * garantindo grande diversidade de fontes para o modelo D1-D7.
 */

import { runCollectionPipeline } from "../server/collector";
import { runStructuredDataPipeline } from "../server/dataCollector";
import { logger } from "../server/_core/logger";

const INTERVAL_MS = 10 * 60 * 1000; // 10 minutos

async function loop() {
  logger.info(" Iniciando ciclo de coleta de sinais (10 minutos)...");
  
  try {
    // 1. Coleta de notícias e RSS (NewsAPI, Google RSS)
    const newsResults = await runCollectionPipeline();
    const totalNews = newsResults.reduce((acc, curr) => acc + curr.total, 0);
    logger.info(` Notícias coletadas: ${totalNews}`);
    
    // 2. Coleta de dados estruturados (IBAMA, IBGE, INPE, ANA)
    const dataResults = await runStructuredDataPipeline();
    const totalData = dataResults.reduce((acc, curr) => acc + curr.total, 0);
    logger.info(` Dados estruturados coletados: ${totalData}`);

    logger.info(` Ciclo concluído com sucesso. Total: ${totalNews + totalData} sinais.`);
  } catch (error) {
    logger.error(" Erro durante o ciclo de coleta:", error);
  }

  logger.info(` Próximo ciclo em 10 minutos...`);
  setTimeout(loop, INTERVAL_MS);
}

// Inicializar
logger.info(" Iniciando Feed Loop do Motor de Inteligência...");
loop();
