import { createElement, Fragment, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

type Tag = "h1" | "h2" | "h3" | "p" | "span" | "div";

export interface PalavrasProps {
  texto: string;
  as?: Tag;
  className?: string;
  id?: string;
  style?: CSSProperties;
  /** Segundos de espera antes de subir (hero usa para orquestrar). */
  atraso?: number;
  /** true: as palavras acendem com o scroll (ligado pela pagina), sem mascara de entrada. */
  scrub?: boolean;
  /** Palavras entre asteriscos recebem o acento bronze: "Toda operação tem um *CEP*." */
}

/**
 * Texto dividido em palavras para o reveal por mascara. A divisao e feita no
 * React (nao no DOM), entao re-render nao quebra. Leitor de tela recebe o texto
 * inteiro uma vez; as palavras animadas ficam aria-hidden.
 */
export function Palavras({ texto, as = "h2", className, id, style, atraso, scrub = false }: PalavrasProps) {
  const limpo = texto.replace(/\*/g, "");
  const partes = texto.split(/\s+/).filter(Boolean);
  const filhos = [
    <span key="sr" className="sr-only">
      {limpo}
    </span>,
    <span key="vis" aria-hidden="true">
      {partes.map((p, i) => {
        const acento = p.startsWith("*") || p.endsWith("*");
        const palavra = p.replace(/\*/g, "");
        return (
          <Fragment key={i}>
            {i > 0 && " "}
            <span className="mo-wm">
              <span className={cn("mo-w", acento && "text-acento-texto")}>{palavra}</span>
            </span>
          </Fragment>
        );
      })}
    </span>,
  ];
  return createElement(
    as,
    {
      id,
      style,
      className: cn("text-balance", className),
      "data-mo": scrub ? undefined : "words",
      "data-lp-scrub": scrub ? "" : undefined,
      "data-mo-delay": atraso,
    },
    filhos
  );
}
