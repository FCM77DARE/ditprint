/**
 * D2 — Dimensão Socioeconômica
 *
 * Sources: IBGE Censo, IBGE Renda, PNUD Atlas, IPEAData
 */

import { BaseDimensionAgent, type IndicatorKeywordRule } from "../base-dimension";
import type { DimensionId } from "../../indicators";
import { SrcIbgeCenso } from "../sources/d2/src-ibge-censo";
import { SrcIbgeRenda } from "../sources/d2/src-ibge-renda";
import { SrcPnudAtlas } from "../sources/d2/src-pnud-atlas";
import { SrcIpeadata } from "../sources/d2/src-ipeadata";

export class DimSocioeconomico extends BaseDimensionAgent {
  readonly id: DimensionId = "D2";
  readonly sources = [
    new SrcIbgeCenso(),
    new SrcIbgeRenda(),
    new SrcPnudAtlas(),
    new SrcIpeadata(),
  ];

  readonly classificationRules: IndicatorKeywordRule[] = [
    // 2.1.1.1 — Pirâmide etária
    {
      indicatorCode: "2.1.1.1",
      keywords: ["pirâmide etária", "faixa etária", "envelhecimento populacional", "jovens", "idosos", "censo demográfico"],
      baseImpact: 0.3,
    },
    // 2.1.1.2 — Distribuição urbano/rural
    {
      indicatorCode: "2.1.1.2",
      keywords: ["população urbana", "população rural", "êxodo rural", "migração campo", "urbanização"],
      baseImpact: 0.3,
    },
    // 2.1.1.3 — Densidade demográfica
    {
      indicatorCode: "2.1.1.3",
      keywords: ["densidade demográfica", "superpopulação", "adensamento", "crescimento populacional", "hab/km²"],
      baseImpact: 0.35,
    },
    // 2.1.1.4 — IDH
    {
      indicatorCode: "2.1.1.4",
      keywords: ["IDH", "índice de desenvolvimento humano", "PNUD", "atlas do desenvolvimento", "desenvolvimento humano"],
      baseImpact: 0.5,
    },
    // 2.2.1.1 — Renda per capita
    {
      indicatorCode: "2.2.1.1",
      keywords: ["renda per capita", "renda média", "salário médio", "rendimento médio", "PIB per capita"],
      baseImpact: 0.45,
    },
    // 2.2.1.2 — Desemprego e informalidade
    {
      indicatorCode: "2.2.1.2",
      keywords: ["desemprego", "desocupação", "informalidade", "trabalho informal", "PNAD", "demissão em massa", "fechamento de fábrica", "layoff"],
      baseImpact: 0.6,
    },
    // 2.2.1.3 — Taxa de pobreza
    {
      indicatorCode: "2.2.1.3",
      keywords: ["pobreza extrema", "extrema pobreza", "bolsa família", "cadastro único", "insegurança alimentar", "fome", "miserabilidade"],
      baseImpact: 0.65,
    },
    // 2.2.1.4 — Índice de Gini
    {
      indicatorCode: "2.2.1.4",
      keywords: ["gini", "desigualdade de renda", "concentração de renda", "coeficiente de gini", "desigualdade social"],
      baseImpact: 0.5,
    },
  ];
}
