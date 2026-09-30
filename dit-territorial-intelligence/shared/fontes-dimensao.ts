/**
 * Em qual dimensão cada fonte da malha trabalha. Gerado do código dos agentes
 * (server/agents/sources/dN) em 30/09/2026; usado pelo relatório para dizer, por
 * dimensão, quais fontes responderam e quais voltaram vazias.
 *
 * `src-google-news` e `src-universidades` são de D6 na origem, mas os sinais
 * que passam pelo verificador são redistribuídos pelas dimensões.
 */
export const DIMENSAO_DA_FONTE: Record<string, "D1" | "D2" | "D3" | "D4" | "D5" | "D6"> = {
  "src-cemaden": "D1",
  "src-cnuc": "D1",
  "src-cptec-inpe": "D1",
  "src-fiocruz-clima": "D1",
  "src-ibama-embargos": "D1",
  "src-ibama": "D1",
  "src-ibge-mapbiomas": "D1",
  "src-inea": "D1",
  "src-inmet": "D1",
  "src-inpe-deter": "D1",
  "src-mp-ambiental": "D1",
  "src-s2id-reconhecimentos": "D1",
  "src-secretarias-ma": "D1",
  "src-terrabrasilis-prodes": "D1",
  "src-ibge-censo": "D2",
  "src-ibge-renda": "D2",
  "src-ipeadata": "D2",
  "src-pnud-atlas": "D2",
  "src-estrutural-d2": "D2",
  "src-aneel-siga": "D3",
  "src-antt-portos": "D3",
  "src-datasus-real": "D3",
  "src-datasus": "D3",
  "src-ibge-habitacao": "D3",
  "src-inep-ideb": "D3",
  "src-inep": "D3",
  "src-mapa-empresas": "D3",
  "src-sinir": "D3",
  "src-snis-sinasa": "D3",
  "src-snis": "D3",
  "src-pncp-obras": "D3",
  "src-estrutural-d3": "D3",
  "src-fogo-cruzado": "D4",
  "src-funai-iphan": "D4",
  "src-geni-uff": "D4",
  "src-incra-sipra": "D4",
  "src-isp-ssp": "D4",
  "src-judiciario": "D4",
  "src-plano-diretor": "D4",
  "src-unicamp-terr": "D4",
  "src-estrutural-d4": "D4",
  "src-audiencias": "D5",
  "src-conselhos": "D5",
  "src-orcamento-participativo": "D5",
  "src-pncp": "D5",
  "src-querido-diario": "D5",
  "src-siconfi": "D5",
  "src-bluesky-territorio": "D6",
  "src-camara-proposicoes": "D6",
  "src-google-news": "D6",
  "src-google-trends": "D6",
  "src-reddit-br": "D6",
  "src-redes-sociais": "D6",
  "src-universidades": "D6",
  "src-youtube-territorio": "D6",
};

/** Fontes cujo conteúdo é cobertura de imprensa, não medição oficial. */
export const FONTES_DE_IMPRENSA = new Set(["src-google-news", "src-universidades", "src-cemaden"]);
