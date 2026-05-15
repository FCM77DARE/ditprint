/**
 * D7 — Dimensão Recursos Naturais e Potencial
 *
 * Sources: Google News, Universidades (Reutilizados para captar minerais, energia, recursos)
 */

import { BaseDimensionAgent, type IndicatorKeywordRule } from "../base-dimension";
import type { DimensionId } from "../../indicators";
import { SrcGoogleNews } from "../sources/d6/src-google-news";
import { SrcUniversidades } from "../sources/d6/src-universidades";

export class DimRecursos extends BaseDimensionAgent {
  readonly id: DimensionId = "D7";
  readonly sources = [
    new SrcGoogleNews(), // Reutilizando para extrair menções na mídia sobre data centers, terras raras, mineração
    new SrcUniversidades(), // Reutilizando para extrair estudos e publicações sobre minerais e potencial energético
  ];

  readonly classificationRules: IndicatorKeywordRule[] = [
    // 7.1.1.1 — Minerais Estratégicos
    {
      indicatorCode: "7.1.1.1",
      keywords: ["terras raras", "lítio", "nióbio", "minerais críticos", "extração mineral", "jazida", "potencial mineral", "mineração", "grafeno"],
      baseImpact: 0.6,
    },
    // 7.1.2.1 — Disponibilidade Hídrica
    {
      indicatorCode: "7.1.2.1",
      keywords: ["balanço hídrico", "saturação hídrica", "escassez de água", "crise hídrica", "aquífero", "bacia hidrográfica", "consumo de água"],
      baseImpact: 0.5,
    },
    // 7.2.1.1 — Energias Renováveis
    {
      indicatorCode: "7.2.1.1",
      keywords: ["potencial eólico", "parque solar", "usina eólica", "hidrogênio verde", "transição energética", "energia renovável", "offshore"],
      baseImpact: 0.5,
    },
    // 7.2.2.1 — Data Centers e Conectividade
    {
      indicatorCode: "7.2.2.1",
      keywords: ["data center", "datacenter", "infraestrutura tecnológica", "fibra ótica", "conectividade", "hub tecnológico", "nuvem", "cloud computing"],
      baseImpact: 0.5,
    },
  ];
}
