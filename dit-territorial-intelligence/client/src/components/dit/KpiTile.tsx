import { cn } from "@/lib/utils";
import { fmtDelta } from "./tensao";
import { LoadingBlock } from "./Estados";

export interface KpiTileProps {
  rotulo: string;
  /** null = sem dado. */
  valor: number | string | null;
  unidade?: string;
  /** Comparacao obrigatoria. Sem ela, o tile diz que nao ha base. */
  comparacao?: { delta: number; rotulo: string };
  carregando?: boolean;
  className?: string;
}

export function KpiTile({ rotulo, valor, unidade, comparacao, carregando, className }: KpiTileProps) {
  const caixa = cn("rounded-[6px] border bg-card p-4", className);
  if (carregando) {
    return (
      <div className={caixa}>
        <LoadingBlock linhas={2} rotulo={`Carregando ${rotulo}`} />
      </div>
    );
  }
  return (
    <div className={caixa}>
      <p className="text-xs font-medium text-tinta-2">{rotulo}</p>
      <p className="mt-2 flex items-baseline gap-1.5">
        {valor === null ? (
          <span className="text-2xl font-semibold text-tinta-2">sem dado</span>
        ) : (
          <>
            <span className="num text-4xl font-medium leading-none text-tinta">
              {typeof valor === "number" ? valor.toLocaleString("pt-BR") : valor}
            </span>
            {unidade && <span className="text-sm text-tinta-2">{unidade}</span>}
          </>
        )}
      </p>
      <p className="mt-2 text-xs text-tinta-2">
        {comparacao ? (
          <>
            <span className="num font-medium text-tinta">
              {comparacao.delta > 0 ? "▲" : comparacao.delta < 0 ? "▼" : "■"} {fmtDelta(comparacao.delta)}
            </span>{" "}
            {comparacao.rotulo}
          </>
        ) : (
          "sem base de comparação"
        )}
      </p>
    </div>
  );
}
