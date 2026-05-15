import { BaseSourceAgent } from "../../base-source";
import type { RawSignal, CollectOptions } from "../../types";
import type { Territory } from "../../../../drizzle/schema";

export class SrcRedesSociais extends BaseSourceAgent {
  readonly id = "src-redes-sociais";
  readonly dimension = "D6";
  readonly name = "Engajamento em Redes Sociais";

  protected async fetchSignals(territory: Territory, _options: CollectOptions): Promise<RawSignal[]> {
    return [];
  }
}
