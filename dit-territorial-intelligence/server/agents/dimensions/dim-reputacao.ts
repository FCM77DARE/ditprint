/**
 * D6 — Dimensão Reputação e Visibilidade
 *
 * Sources: Google News RSS, Google Trends, Redes Sociais, Universidades
 */

import { BaseDimensionAgent, type IndicatorKeywordRule } from "../base-dimension";
import type { DimensionId } from "../../indicators";
import { SrcGoogleNews } from "../sources/d6/src-google-news";
import { SrcGoogleTrends } from "../sources/d6/src-google-trends";
import { SrcRedesSociais } from "../sources/d6/src-redes-sociais";
import { SrcUniversidades } from "../sources/d6/src-universidades";
import { SrcYoutubeTerritorio } from "../sources/d6/src-youtube-territorio";
import { SrcBlueskyTerritorio } from "../sources/d6/src-bluesky-territorio";
import { SrcRedditBr } from "../sources/d6/src-reddit-br";

export class DimReputacao extends BaseDimensionAgent {
  readonly id: DimensionId = "D6";
  readonly sources = [
    new SrcGoogleNews(),
    new SrcGoogleTrends(),
    new SrcRedesSociais(),
    new SrcUniversidades(),
    new SrcYoutubeTerritorio(),
    new SrcBlueskyTerritorio(),
    new SrcRedditBr(),
  ];

  readonly classificationRules: IndicatorKeywordRule[] = [
    // 6.1.1.1 — Volume de buscas
    {
      indicatorCode: "6.1.1.1",
      keywords: ["território", "notícia", "alagoinhas", "bahia", "regional", "local", "impacto", "repercussão"],
      baseImpact: 0.35,
    },
    // 6.1.1.2 — Matérias positivas e negativas
    {
      indicatorCode: "6.1.1.2",
      keywords: ["reportagem", "notícia", "denúncia", "irregularidade", "interdição", "polícia", "alagoinhas", "catu", "candeias", "prefeitura", "governo", "obras", "evento"],
      baseImpact: 0.3,
    },
    // 6.1.1.3 — Engajamento em redes sociais
    {
      indicatorCode: "6.1.1.3",
      keywords: ["viral", "hashtag", "trending topic", "redes sociais", "Instagram", "Twitter", "TikTok", "campanha nas redes", "compartilhamento"],
      baseImpact: 0.55,
    },
    // 6.2.1.1 — Núcleos e centros de pesquisa
    {
      indicatorCode: "6.2.1.1",
      keywords: ["pesquisa científica", "estudo acadêmico", "universidade", "instituto federal", "pesquisadores", "publicação científica", "artigo científico", "CAPES", "SciELO", "Lattes"],
      baseImpact: 0.45,
    },
    // 6.2.1.2 — Conselhos, comissões e comitês
    {
      indicatorCode: "6.2.1.2",
      keywords: ["comissão técnica", "comitê", "conselho científico", "relatório técnico", "IPEA", "Fiocruz", "relatório ONU", "BID", "banco mundial"],
      baseImpact: 0.55,
    },
  ];
}
