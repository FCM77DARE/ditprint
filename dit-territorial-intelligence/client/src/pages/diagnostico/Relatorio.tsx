import { useEffect, useMemo, useRef } from "react";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { ErrorState, LoadingBlock } from "@/components/dit";
import { MOVIMENTO_SRC, RELATORIO_CSS, renderRelatorio } from "@shared/relatorio-marco/render";
import type { DadosRelatorio } from "@shared/relatorio-marco/tipos";

/**
 * Diagnóstico completo (relatório Marco) em /diagnostico/relatorio/:slug.
 *
 * A marcação vem de shared/relatorio-marco/render.ts, a MESMA que o gerador
 * estático (scripts/gerar-relatorio-marco.ts) grava em HTML: nenhuma das duas
 * saídas tem markup próprio. Acesso: operador (sessão da mesa) ou assinante com
 * o território no contrato, conferido no servidor por portal.relatorio.
 */
function Documento({ dados }: { dados: DadosRelatorio }) {
  const html = useMemo(() => renderRelatorio(dados), [dados]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const raiz = ref.current?.querySelector<HTMLElement>(".mrel");
    if (!raiz) return;
    // Mesmo script do HTML estático: reveal ao rolar, barras que enchem, abre os detalhes na impressão.
    const iniciar = new Function(`return ${MOVIMENTO_SRC}`)() as (r: HTMLElement) => void;
    iniciar(raiz);
  }, [html]);

  useEffect(() => {
    const anterior = document.title;
    document.title = `${dados.territorio.nome}, ${dados.territorio.uf} · Diagnóstico completo · Marco`;
    return () => {
      document.title = anterior;
    };
  }, [dados]);

  return (
    <>
      <style>{`html{scroll-behavior:smooth}@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}${RELATORIO_CSS}`}</style>
      <div ref={ref} dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
}

export default function DiagnosticoRelatorio() {
  const [, params] = useRoute("/diagnostico/relatorio/:slug");
  const slug = params?.slug ?? "";
  const q = trpc.portal.relatorio.useQuery({ slug }, { enabled: Boolean(slug), retry: false });

  if (q.isLoading) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <LoadingBlock />
      </div>
    );
  }
  if (q.error || !q.data) {
    const negado = q.error?.data?.code === "UNAUTHORIZED" || q.error?.data?.code === "FORBIDDEN";
    return (
      <div className="mx-auto max-w-3xl p-8">
        <ErrorState
          motivo={
            negado
              ? "Só o operador da PRINT e o assinante com este território no contrato abrem o diagnóstico completo."
              : (q.error?.message ?? "Não há diagnóstico salvo para este território.")
          }
          proximoPasso={negado ? "Entre pelo link do assinante em /entrar." : "Volte ao portal e peça a leitura do território."}
          acao={negado ? "Entrar" : "Voltar ao portal"}
          onAcao={() => {
            window.location.href = negado ? "/entrar" : "/portal";
          }}
        />
      </div>
    );
  }
  return <Documento dados={q.data as DadosRelatorio} />;
}
