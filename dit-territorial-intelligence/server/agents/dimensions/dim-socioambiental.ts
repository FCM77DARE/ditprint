/**
 * D1 — Dimensão Socioambiental
 *
 * Sources: INMET, CPTEC/INPE, MapBiomas, CNUC, Secretarias MA,
 *          CEMADEN, Fiocruz Clima, INPE DETER, IBAMA, MP Ambiental
 */

import { BaseDimensionAgent, type IndicatorKeywordRule } from "../base-dimension";
import type { DimensionId } from "../../indicators";
import { SrcInmet } from "../sources/d1/src-inmet";
import { SrcCemaden } from "../sources/d1/src-cemaden";
import { SrcInpeDeter } from "../sources/d1/src-inpe-deter";
import { SrcIbama } from "../sources/d1/src-ibama";
import { SrcCnuc } from "../sources/d1/src-cnuc";
import { SrcSecretariasMa } from "../sources/d1/src-secretarias-ma";
import { SrcFiocruzClima } from "../sources/d1/src-fiocruz-clima";
import { SrcMpAmbiental } from "../sources/d1/src-mp-ambiental";
import { SrcCptecInpe } from "../sources/d1/src-cptec-inpe";
import { SrcIbgeMapbiomas } from "../sources/d1/src-ibge-mapbiomas";
import { SrcInea } from "../sources/d1/src-inea";

export class DimSocioambiental extends BaseDimensionAgent {
  readonly id: DimensionId = "D1";
  readonly sources = [
    new SrcInmet(),
    new SrcCemaden(),
    new SrcInpeDeter(),
    new SrcIbama(),
    new SrcCnuc(),
    new SrcSecretariasMa(),
    new SrcFiocruzClima(),
    new SrcMpAmbiental(),
    new SrcCptecInpe(),
    new SrcIbgeMapbiomas(),
    new SrcInea(),
  ];

  readonly classificationRules: IndicatorKeywordRule[] = [
    // 1.1.1.1 — % APA
    {
      indicatorCode: "1.1.1.1",
      keywords: ["área de proteção ambiental", "apa ", " apa", "unidade de conservação", "uc ", " uc", "ICMBio", "cnuc"],
      baseImpact: 0.4,
    },
    // 1.1.1.2 — % APP
    {
      indicatorCode: "1.1.1.2",
      keywords: ["área de preservação permanente", "app ", " app", "mata ciliar", "reserva legal", "car "],
      baseImpact: 0.45,
    },
    // 1.1.1.3 — Cumprimento da legislação ambiental
    {
      indicatorCode: "1.1.1.3",
      keywords: ["auto de infração", "embargo", "multa ambiental", "autuação ambiental", "ibama", "inea", "icmbio", "fiscalização ambiental", "CAR irregular", "desmatamento ilegal"],
      baseImpact: 0.65,
    },
    // 1.2.1.1 — Eventos climáticos extremos
    {
      indicatorCode: "1.2.1.1",
      keywords: ["emergência climática", "enchente", "inundação", "deslizamento", "seca severa", "estiagem", "queimada", "incêndio florestal", "ciclone", "tempestade severa", "CEMADEN", "alerta vermelho"],
      baseImpact: 0.72,
    },
    // 1.2.1.2 — Degradação ambiental
    {
      indicatorCode: "1.2.1.2",
      keywords: ["DETER", "PRODES", "desmatamento", "focos de calor", "foco de incêndio", "degradação ambiental", "erosão", "assoreamento"],
      baseImpact: 0.6,
    },
    // 1.3.1.1 — Acidentes com contaminação
    {
      indicatorCode: "1.3.1.1",
      keywords: ["derramamento", "contaminação", "vazamento de óleo", "acidente ambiental", "rompimento de barragem", "passivo ambiental", "lençol freático contaminado"],
      baseImpact: 0.8,
    },
    // 1.3.1.2 — TACs ambientais ativos
    {
      indicatorCode: "1.3.1.2",
      keywords: ["TAC ambiental", "termo de ajustamento de conduta", "acordo ambiental", "ministério público ambiental"],
      baseImpact: 0.55,
    },
    // 1.3.1.3 — ACPs ambientais
    {
      indicatorCode: "1.3.1.3",
      keywords: ["ACP ambiental", "ação civil pública", "ação judicial ambiental", "liminar ambiental"],
      baseImpact: 0.65,
    },
    // 1.3.1.4 — Empreendimentos de médio/grande porte
    {
      indicatorCode: "1.3.1.4",
      keywords: ["EIA", "RIMA", "estudo de impacto ambiental", "licenciamento ambiental", "licença prévia", "licença de instalação", "licença de operação", "INEA"],
      baseImpact: 0.4,
    },
  ];
}
