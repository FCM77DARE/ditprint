/**
 * D4 — Dimensão Dinâmica Territorial
 *
 * Sources: Plano Diretor, Judiciário, Fogo Cruzado, GENI/UFF,
 *          ISP/SSP, FUNAI/IPHAN, Unicamp Territórios
 */

import { BaseDimensionAgent, type IndicatorKeywordRule } from "../base-dimension";
import type { DimensionId } from "../../indicators";
import { SrcPlanoDiretor } from "../sources/d4/src-plano-diretor";
import { SrcJudiciario } from "../sources/d4/src-judiciario";
import { SrcFogoCruzado } from "../sources/d4/src-fogo-cruzado";
import { SrcGeniUff } from "../sources/d4/src-geni-uff";
import { SrcIspSsp } from "../sources/d4/src-isp-ssp";
import { SrcFunaiIphan } from "../sources/d4/src-funai-iphan";
import { SrcUnicampTerr } from "../sources/d4/src-unicamp-terr";
import { SrcIncraSipra } from "../sources/d4/src-incra-sipra";
import { SrcGoogleNews } from "../sources/d6/src-google-news";

export class DimDinamica extends BaseDimensionAgent {
  readonly id: DimensionId = "D4";
  readonly sources = [
    new SrcPlanoDiretor(),
    new SrcJudiciario(),
    new SrcFogoCruzado(),
    new SrcGeniUff(),
    new SrcIspSsp(),
    new SrcFunaiIphan(),
    new SrcUnicampTerr(),
    new SrcIncraSipra(),
    new SrcGoogleNews(),
  ];

  readonly classificationRules: IndicatorKeywordRule[] = [
    // 4.1.1.1 — Zoneamento e planejamento urbano
    {
      indicatorCode: "4.1.1.1",
      keywords: ["plano diretor", "zoneamento urbano", "uso e ocupação do solo", "zona especial", "revisão do plano diretor", "macrozoneamento"],
      baseImpact: 0.4,
    },
    // 4.1.1.2 — Áreas de lazer e espaços públicos
    {
      indicatorCode: "4.1.1.2",
      keywords: ["parque urbano", "praça", "área de lazer", "espaço público", "demolição de parque", "privatização de área pública"],
      baseImpact: 0.35,
    },
    // 4.1.1.3 — Características marcantes
    {
      indicatorCode: "4.1.1.3",
      keywords: ["patrimônio histórico", "tombamento", "IPHAN", "sítio arqueológico", "patrimônio cultural", "patrimônio imaterial"],
      baseImpact: 0.4,
    },
    // 4.1.1.4 — Empreendimentos previstos/em implantação
    {
      indicatorCode: "4.1.1.4",
      keywords: ["grande empreendimento", "complexo logístico", "usina", "hidrelétrica", "mineração", "terminal", "parque eólico", "parque fotovoltaico", "empreendimento imobiliário"],
      baseImpact: 0.55,
    },
    // 4.2.1.1 — Conflitos com poder público
    {
      indicatorCode: "4.2.1.1",
      keywords: ["conflito com prefeitura", "conflito com estado", "remoção forçada", "reintegração de posse", "desapropriação", "ação do poder público", "protesto contra prefeitura"],
      baseImpact: 0.6,
    },
    // 4.2.1.2 — Conflitos com setor privado
    {
      indicatorCode: "4.2.1.2",
      keywords: ["conflito com empresa", "disputa judicial", "ação contra empresa", "protesto contra mineradora", "impacto de empreendimento", "comunidade versus empresa"],
      baseImpact: 0.6,
    },
    // 4.2.3.1 — Segurança Pública
    {
      indicatorCode: "4.2.3.1",
      keywords: ["fogo cruzado", "tiroteio", "facção", "milícia", "poder paralelo", "crime organizado", "tráfico", "violência", "homicídio", "assalto", "polícia"],
      baseImpact: 0.6,
    },
    // 4.2.1.3 — Poder paralelo (HIGHEST WEIGHT)
    {
      indicatorCode: "4.2.1.3",
      keywords: ["milícia", "poder paralelo", "facção", "tráfico", "crime organizado", "grupo armado", "territorialização do crime", "fogo cruzado", "tiroteio", "confronto armado"],
      baseImpact: 0.8,
    },
    // 4.2.1.4 — Sobrecarga de projetos
    {
      indicatorCode: "4.2.1.4",
      keywords: ["sobreposição de projetos", "múltiplos empreendimentos", "cumulatividade de impactos", "plano de desenvolvimento"],
      baseImpact: 0.4,
    },
    // 4.3.1.1 — Populações em áreas de risco
    {
      indicatorCode: "4.3.1.1",
      keywords: ["área de risco", "encosta de risco", "várzea", "risco geológico", "risco hidrológico", "ocupação irregular em risco", "defesa civil", "remoção de área de risco", "deslizamento em comunidade"],
      baseImpact: 0.7,
    },
    // 4.4.1.1 — Comunidades tradicionais
    {
      indicatorCode: "4.4.1.1",
      keywords: ["terra indígena", "comunidade indígena", "quilombola", "comunidade quilombola", "ribeirinho", "caiçara", "povos originários", "FUNAI", "demarcação indígena"],
      baseImpact: 0.7,
    },
    // 4.4.1.2 — Assentamentos rurais
    {
      indicatorCode: "4.4.1.2",
      keywords: ["assentamento", "assentamento rural", "MST", "conflito agrário", "reforma agrária", "ocupação de terra", "INCRA", "SIPRA", "sem-terra", "famílias assentadas", "projeto de assentamento"],
      baseImpact: 0.65,
    },
    // 4.4.1.3 — Reconhecimento territorial
    {
      indicatorCode: "4.4.1.3",
      keywords: ["demarcação", "titulação", "regularização fundiária", "processo de reconhecimento", "territórios tradicionais", "RTID", "relatório circunstanciado"],
      baseImpact: 0.5,
    },
  ];
}
