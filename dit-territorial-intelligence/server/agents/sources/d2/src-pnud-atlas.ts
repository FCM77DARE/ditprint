import { BaseSourceAgent } from "../../base-source";
import type { RawSignal, CollectOptions } from "../../types";
import type { Territory } from "../../../../drizzle/schema";

export class SrcPnudAtlas extends BaseSourceAgent {
  readonly id = "src-pnud-atlas";
  readonly dimension = "D2";
  readonly name = "PNUD - Atlas do Desenvolvimento Humano (IDH)";
  readonly cacheTtlMs = 1000 * 60 * 60 * 24 * 30; // 30 dias

  protected async fetchSignals(
    territory: Territory,
    options: CollectOptions
  ): Promise<RawSignal[]> {
    const ctx = territory.contextData as Record<string, unknown> | null;
    const ibgeMuns = (ctx?.ibgeMunicipios as string[]) ?? [];
    const signals: RawSignal[] = [];

    // Atlas Brasil não expõe API REST aberta documentada.
    // Estratégia 1: Google News RSS para notícias recentes sobre IDH do território.
    try {
      const query = encodeURIComponent(`IDH ${territory.name}`);
      const url = `https://news.google.com/rss/search?q=${query}&hl=pt-BR&gl=BR&ceid=BR:pt-BR`;
      const res = await fetch(url, { signal: options.signal });
      if (res.ok) {
        const xml = await res.text();
        // Parse simples de itens RSS
        const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
        for (const item of items.slice(0, 5)) {
          const title = item.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim();
          const link = item.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim();
          const pubDate = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim();
          if (!title) continue;
          signals.push({
            title: `Notícia IDH: ${this.stripCdata(title)}`,
            summary: `Cobertura recente sobre IDH/desenvolvimento humano relacionada a ${territory.name}.`,
            url: link ? this.stripCdata(link) : undefined,
            sourceAgentId: this.id,
            publishedAt: pubDate ? new Date(pubDate) : new Date(),
            metadata: { provider: "google-news-rss", territory: territory.slug },
          });
        }
      }
    } catch (err) {
      this.log.warn({ err }, "Google News RSS falhou (tolerado)");
    }

    // Sem Estratégia 2. O bloco anterior emitia "consultar Atlas Brasil" como
    // sinal — lembrete, não medição. Contava como fonte resolutiva, inflava a
    // cobertura e derrubava o STT sem nenhuma evidência por trás. Território
    // sem cobertura tem que aparecer como sem cobertura.
    // O IDHM entra pela carga estrutural em lote (scripts/load-*), não aqui.

    return signals;
  }

  private stripCdata(value: string): string {
    return value.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim();
  }
}
