import { BaseSourceAgent } from "../../base-source";
import type { RawSignal, CollectOptions } from "../../types";
import type { Territory } from "../../../../drizzle/schema";

export class SrcOrcamentoParticipativo extends BaseSourceAgent {
  readonly id = "src-orcamento-participativo";
  readonly dimension = "D5";
  readonly name = "Orçamento Participativo / LOA / LDO";

  protected async fetchSignals(territory: Territory, _options: CollectOptions): Promise<RawSignal[]> {
    return [];
  }
}
