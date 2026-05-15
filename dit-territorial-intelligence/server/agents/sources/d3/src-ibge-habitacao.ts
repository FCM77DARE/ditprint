import { BaseSourceAgent } from "../../base-source";
import type { RawSignal, CollectOptions } from "../../types";
import type { Territory } from "../../../../drizzle/schema";

export class SrcIbgeHabitacao extends BaseSourceAgent {
  readonly id = "src-ibge-habitacao";
  readonly dimension = "D3";
  readonly name = "IBGE/Fundação João Pinheiro - Déficit Habitacional";

  protected async fetchSignals(
    territory: Territory,
    options: CollectOptions
  ): Promise<RawSignal[]> {
    const ctx = territory.contextData as Record<string, unknown> | null;
    const ibgeMuns = (ctx?.ibgeMunicipios as string[]) ?? [];

    if (ibgeMuns.length === 0) return [];

    const signals: RawSignal[] = [];

    // Para Déficit Habitacional e População Favelada, o IBGE usa o Censo (Agregados)
    // Aqui fazemos uma busca no Agregado 8418 (População residente em favelas/comunidades urbanas)
    // API: https://servicodados.ibge.gov.br/api/v3/agregados/8418/periodos/2022/variaveis/93?localidades=N6[IBGE_ID]
    for (const ibgeId of ibgeMuns) {
      try {
        const url = `https://servicodados.ibge.gov.br/api/v3/agregados/8418/periodos/2022/variaveis/93?localidades=N6%5B${ibgeId}%5D`;
        const res = await fetch(url, { signal: options.signal });
        if (!res.ok) continue;

        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) continue;

        const result = data[0]?.resultados?.[0]?.series?.[0]?.serie?.['2022'];
        if (!result || result === '-') continue;

        const populacaoFavelas = parseInt(result, 10);
        
        if (populacaoFavelas > 0) {
          signals.push({
            title: `IBGE Censo: ${populacaoFavelas.toLocaleString('pt-BR')} pessoas vivendo em favelas/comunidades no município (${ibgeId})`,
            summary: `Dados oficiais do IBGE indicam que o território possui uma população expressiva residindo em aglomerados subnormais ou áreas de déficit habitacional severo.`,
            sourceAgentId: this.id,
            publishedAt: new Date(),
            rawValue: populacaoFavelas,
            unit: 'pessoas',
            metadata: { ibgeId }
          });
        }
      } catch (err) {
        continue;
      }
    }

    return signals;
  }
}
