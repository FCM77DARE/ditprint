/**
 * D3 — Dimensão Infraestrutura e Serviços
 *
 * Sources: SNIS/SINASA, DataSUS, INEP, IBGE Habitação, Mapa Empresas,
 *          ANTT/Portos, SINIR
 */

import { BaseDimensionAgent, type IndicatorKeywordRule } from "../base-dimension";
import type { DimensionId } from "../../indicators";
import { SrcSnisSinasa } from "../sources/d3/src-snis-sinasa";
import { SrcDatasus } from "../sources/d3/src-datasus";
import { SrcInep } from "../sources/d3/src-inep";
import { SrcIbgeHabitacao } from "../sources/d3/src-ibge-habitacao";
import { SrcMapaEmpresas } from "../sources/d3/src-mapa-empresas";
import { SrcAnttPortos } from "../sources/d3/src-antt-portos";
import { SrcSinir } from "../sources/d3/src-sinir";
import { SrcAneelSiga } from "../sources/d3/src-aneel-siga";
import { SrcSnis } from "../sources/d3/src-snis";
import { SrcDatasusReal } from "../sources/d3/src-datasus-real";
import { SrcInepIdeb } from "../sources/d3/src-inep-ideb";
import { SrcGoogleNews } from "../sources/d6/src-google-news";

export class DimInfraestrutura extends BaseDimensionAgent {
  readonly id: DimensionId = "D3";
  readonly sources = [
    new SrcSnisSinasa(),
    new SrcDatasus(),
    new SrcInep(),
    new SrcIbgeHabitacao(),
    new SrcMapaEmpresas(),
    new SrcAnttPortos(),
    new SrcSinir(),
    new SrcAneelSiga(),
    new SrcSnis(),
    new SrcDatasusReal(),
    new SrcInepIdeb(),
    new SrcGoogleNews(),
  ];

  readonly classificationRules: IndicatorKeywordRule[] = [
    // 3.1.1.1 — Saneamento
    {
      indicatorCode: "3.1.1.1",
      keywords: ["saneamento", "água tratada", "esgoto", "abastecimento de água", "rede coletora", "SNIS", "SINASA", "sistema de esgoto", "infraestrutura", "obras", "serviços públicos", "alagoinhas", "cobertura de água", "cobertura de esgoto", "esgoto tratado", "IN055", "IN056", "IN046", "esgoto a céu aberto"],
      baseImpact: 0.35,
    },
    // 3.1.1.2 — Saúde
    {
      indicatorCode: "3.1.1.2",
      keywords: ["saúde pública", "UBS", "unidade básica de saúde", "hospital municipal", "leitos", "mortalidade infantil", "surto", "epidemia", "datasus", "ESF", "cobertura ESF", "estratégia saúde da família", "leitos SUS", "PCDaS"],
      baseImpact: 0.6,
    },
    // 3.1.1.3 — Educação
    {
      indicatorCode: "3.1.1.3",
      keywords: ["IDEB", "educação básica", "alfabetização", "analfabetismo", "evasão escolar", "matrícula escolar", "INEP", "nota IDEB", "anos iniciais", "anos finais", "qualidade da educação"],
      baseImpact: 0.5,
    },
    // 3.1.1.4 — Habitação
    {
      indicatorCode: "3.1.1.4",
      keywords: ["déficit habitacional", "habitação irregular", "moradia inadequada", "favela", "comunidade", "ocupação urbana", "sem-teto"],
      baseImpact: 0.5,
    },
    // 3.1.1.5 — Resíduo sólido
    {
      indicatorCode: "3.1.1.5",
      keywords: ["lixão", "aterro sanitário", "resíduo sólido", "coleta de lixo", "SINIR", "gestão de resíduos", "descarte irregular"],
      baseImpact: 0.5,
    },
    // 3.2.1.1 — Indústrias
    {
      indicatorCode: "3.2.1.1",
      keywords: ["polo industrial", "indústria", "estabelecimento industrial", "fábrica", "complexo industrial", "setor secundário"],
      baseImpact: 0.4,
    },
    // 3.2.1.2 — Serviços e Comércio
    {
      indicatorCode: "3.2.1.2",
      keywords: ["comércio", "setor terciário", "serviços", "estabelecimentos comerciais", "mercado local"],
      baseImpact: 0.3,
    },
    // 3.2.1.3 — Agricultura e Pecuária
    {
      indicatorCode: "3.2.1.3",
      keywords: ["agronegócio", "agricultura", "pecuária", "produção agrícola", "conflito agrário", "assentamento rural", "reforma agrária"],
      baseImpact: 0.4,
    },
    // 3.3.1.1 — Transporte e Mobilidade
    {
      indicatorCode: "3.3.1.1",
      keywords: ["rodovia", "mobilidade urbana", "transporte público", "BRT", "metrô", "interdição de via", "colapso no trânsito", "congestionamento"],
      baseImpact: 0.5,
    },
    // 3.3.1.2 — Infraestrutura portuária e hidroviária
    {
      indicatorCode: "3.3.1.2",
      keywords: ["porto", "terminal portuário", "hidrovia", "dragagem", "terminal de cargas", "ANTAQ"],
      baseImpact: 0.45,
    },
    // 3.3.1.3 — Infraestrutura aeroportuária
    {
      indicatorCode: "3.3.1.3",
      keywords: ["aeroporto", "terminal aéreo", "ANAC", "pista de pouso", "ampliação do aeroporto"],
      baseImpact: 0.35,
    },
    // 3.3.1.4 — Geração energética (parques eólicos, solares, hidrelétricas, térmicas)
    // ANEEL SIGA detecta empreendimentos por município de forma estruturada.
    {
      indicatorCode: "3.3.1.4",
      keywords: [
        "ANEEL", "empreendimento", "energia eólica", "parque eólico", "energia solar",
        "usina solar", "hidrelétrica", "usina térmica", "geração", "MW",
        "potência", "outorga", "fonte combustível",
      ],
      baseImpact: 0.55,
    },
  ];
}
