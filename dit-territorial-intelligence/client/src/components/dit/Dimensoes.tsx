import { cn } from "@/lib/utils";
import type { DimensaoLeitura, FonteDimensao } from "@shared/leitura";
import { CircleDashed, Layers, Radio, Waypoints, type LucideIcon } from "lucide-react";
import { clamp, faixaDeTensao, fmtInt } from "./tensao";
import { EmptyState, LoadingBlock } from "./Estados";

const FONTE: Record<FonteDimensao, { rotulo: string; Icone: LucideIcon }> = {
  estrutural: { rotulo: "Estrutural", Icone: Layers },
  sinal: { rotulo: "Sinal", Icone: Radio },
  ambos: { rotulo: "Ambos", Icone: Waypoints },
  nenhuma: { rotulo: "Nenhuma", Icone: CircleDashed },
};

function FonteTag({ fonte }: { fonte: FonteDimensao }) {
  const { rotulo, Icone } = FONTE[fonte];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-tinta-2">
      <Icone size={14} aria-hidden />
      {rotulo}
    </span>
  );
}

/** Linha densa de dimensao. Score null vira "nao medida", nunca 100. */
export function DimensaoRow({ dimensao }: { dimensao: DimensaoLeitura }) {
  const { nome, score, peso, medida, fonte } = dimensao;
  const naoMedida = score === null || !medida;
  const valor = naoMedida ? null : clamp(score as number);
  const cor = valor === null ? undefined : faixaDeTensao(valor).cor;

  return (
    <tr className="border-t text-sm">
      <th scope="row" className="py-2 pr-3 text-left font-medium text-tinta">
        {nome}
      </th>
      <td className="w-[38%] min-w-[96px] py-2 pr-3">
        <div
          className="h-[8px]"
          style={{ background: "var(--muted)" }}
          role={valor === null ? undefined : "img"}
          aria-label={valor === null ? undefined : `${nome}: ${fmtInt(valor)} de 100`}
          aria-hidden={valor === null ? true : undefined}
        >
          {valor !== null && <div data-mo="bar" className="h-full" style={{ width: `${valor}%`, background: cor }} />}
        </div>
      </td>
      <td className="num py-2 pr-3 text-right text-tinta">
        {valor === null ? (
          <span className="font-body text-xs text-tinta-2">não medida</span>
        ) : (
          <span data-mo="count">{fmtInt(valor)}</span>
        )}
      </td>
      <td className="num py-2 pr-3 text-right text-tinta-2">
        {peso <= 1 ? `${fmtInt(peso * 100)}%` : fmtInt(peso)}
      </td>
      <td className="py-2">
        <FonteTag fonte={fonte} />
      </td>
    </tr>
  );
}

export interface DimensoesTableProps {
  dimensoes: DimensaoLeitura[] | undefined;
  carregando?: boolean;
  /** Ordena pelo valor que importa (maior tensao primeiro); nao medidas por ultimo. */
  ordenarPorValor?: boolean;
  className?: string;
}

export function DimensoesTable({
  dimensoes,
  carregando,
  ordenarPorValor = true,
  className,
}: DimensoesTableProps) {
  if (carregando) return <LoadingBlock linhas={6} rotulo="Carregando dimensões" />;
  if (!dimensoes || dimensoes.length === 0) {
    return (
      <EmptyState
        titulo="Nenhuma dimensão medida"
        descricao="A leitura ainda não trouxe dimensões para este território."
        acao="Coletar sinais"
      />
    );
  }
  const linhas = ordenarPorValor
    ? [...dimensoes].sort((a, b) => {
        const sa = a.medida && a.score !== null ? a.score : -1;
        const sb = b.medida && b.score !== null ? b.score : -1;
        return sb - sa;
      })
    : dimensoes;
  const naoMedidas = dimensoes.filter(d => d.score === null || !d.medida).length;

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full border-collapse">
        <caption className="sr-only">Dimensões da tensão, ordenadas pelo maior valor</caption>
        <thead>
          <tr className="text-left text-xs text-tinta-2">
            <th scope="col" className="pb-2 pr-3 font-medium">Dimensão</th>
            <th scope="col" className="pb-2 pr-3 font-medium">Tensão (0 a 100)</th>
            <th scope="col" className="pb-2 pr-3 text-right font-medium">Valor</th>
            <th scope="col" className="pb-2 pr-3 text-right font-medium">Peso</th>
            <th scope="col" className="pb-2 font-medium">Fonte</th>
          </tr>
        </thead>
        <tbody data-mo="stagger">
          {linhas.map(d => (
            <DimensaoRow key={d.id} dimensao={d} />
          ))}
        </tbody>
      </table>
      {naoMedidas > 0 && (
        <p className="nota mt-2">
          {naoMedidas} {naoMedidas === 1 ? "dimensão não medida" : "dimensões não medidas"}; ficam fora do
          cálculo, sem valor assumido.
        </p>
      )}
    </div>
  );
}
