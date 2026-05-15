/**
 * D5 — Dimensão Governança e Articulação
 *
 * Sources: Querido Diário, Conselhos Municipais, Audiências, Orçamento Participativo
 */

import { BaseDimensionAgent, type IndicatorKeywordRule } from "../base-dimension";
import type { DimensionId } from "../../indicators";
import { SrcQueridoDiario } from "../sources/d5/src-querido-diario";
import { SrcConselhos } from "../sources/d5/src-conselhos";
import { SrcAudiencias } from "../sources/d5/src-audiencias";
import { SrcOrcamentoParticipativo } from "../sources/d5/src-orcamento-participativo";
import { SrcGoogleNews } from "../sources/d6/src-google-news";
import { SrcJudiciario } from "../sources/d4/src-judiciario";

export class DimGovernanca extends BaseDimensionAgent {
  readonly id: DimensionId = "D5";
  readonly sources = [
    new SrcQueridoDiario(),
    new SrcConselhos(),
    new SrcAudiencias(),
    new SrcOrcamentoParticipativo(),
    new SrcGoogleNews(),
    new SrcJudiciario(),
  ];

  readonly classificationRules: IndicatorKeywordRule[] = [
    // 5.1.1.1 — Instituições e movimentos atuantes
    {
      indicatorCode: "5.1.1.1",
      keywords: ["ONG", "organização não governamental", "movimento social", "associação de moradores", "entidade civil", "fundação", "instituto"],
      baseImpact: 0.35,
    },
    // 5.1.1.2 — Cadastro em conselhos
    {
      indicatorCode: "5.1.1.2",
      keywords: ["conselho municipal", "conselho de saúde", "conselho de educação", "conselho do meio ambiente", "conselho tutelar", "conselho de habitação", "reunião de conselho"],
      baseImpact: 0.4,
    },
    // 5.1.1.3 — Capacidade de autogestão
    {
      indicatorCode: "5.1.1.3",
      keywords: ["cooperativa", "autogestão", "gestão comunitária", "economia solidária", "associação", "gestão participativa"],
      baseImpact: 0.4,
    },
    // 5.2.1.1 — Perfil comunitário e representatividade
    {
      indicatorCode: "5.2.1.1",
      keywords: ["representatividade", "diversidade", "inclusão", "participação feminina", "participação jovem", "representação de minorias"],
      baseImpact: 0.35,
    },
    // 5.2.1.2 — Participação em controle social
    {
      indicatorCode: "5.2.1.2",
      keywords: ["audiência pública", "consulta pública", "conferência municipal", "controle social", "participação popular", "oitiva", "consulta prévia"],
      baseImpact: 0.5,
    },
    // 5.2.1.3 — Engajamento digital
    {
      indicatorCode: "5.2.1.3",
      keywords: ["petição", "abaixo-assinado", "mobilização online", "campanha digital", "ativismo digital"],
      baseImpact: 0.35,
    },
    // 5.3.1.1 — TACs e acordos de conduta (governança)
    {
      indicatorCode: "5.3.1.1",
      keywords: ["TAC governança", "termo de ajustamento de gestão", "acordo de conduta", "ministério público", "MP municipal"],
      baseImpact: 0.55,
    },
    // 5.3.1.2 — Orçamento participativo e execução
    {
      indicatorCode: "5.3.1.2",
      keywords: ["orçamento participativo", "OP ", " OP", "PPA", "plano plurianual", "execução orçamentária", "desvio de verba", "corrupção", "improbidade"],
      baseImpact: 0.65,
    },
    // 5.3.1.3 — Prestação de contas e transparência
    {
      indicatorCode: "5.3.1.3",
      keywords: ["portal de transparência", "prestação de contas", "diário oficial", "querido diário", "CGU", "CGM", "tribunal de contas", "investigação", "fraude", "alagoinhas", "prefeitura", "notícia"],
      baseImpact: 0.35,
    },
  ];
}
