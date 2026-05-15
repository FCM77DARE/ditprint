import { BaseSourceAgent } from "../../base-source";
import type { RawSignal, CollectOptions } from "../../types";
import type { Territory } from "../../../../drizzle/schema";

export class SrcSecretariasMa extends BaseSourceAgent {
  readonly id = "src-secretarias-ma";
  readonly dimension = "D1";
  readonly name = "Secretarias Estaduais de Meio Ambiente (via Apify)";

  protected async fetchSignals(territory: Territory, _options: CollectOptions): Promise<RawSignal[]> {
    return [];
  }
}
