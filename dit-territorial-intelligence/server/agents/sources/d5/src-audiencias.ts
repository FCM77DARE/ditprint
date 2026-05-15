import { BaseSourceAgent } from "../../base-source";
import type { RawSignal, CollectOptions } from "../../types";
import type { Territory } from "../../../../drizzle/schema";

export class SrcAudiencias extends BaseSourceAgent {
  readonly id = "src-audiencias";
  readonly dimension = "D5";
  readonly name = "Audiências Públicas (Legislativo)";

  protected async fetchSignals(territory: Territory, _options: CollectOptions): Promise<RawSignal[]> {
    return [];
  }
}
