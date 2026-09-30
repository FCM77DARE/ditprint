import { useEffect } from "react";
import { Secao } from "@/components/dit";

export interface ItemFaq {
  pergunta: string;
  resposta: string;
}

/**
 * FAQ como matriz de objecoes (landing-conversao, tecnica 11). Usa details/summary:
 * teclado e leitor de tela de graca, sem JS de acordeao. Marca FAQPage em JSON-LD
 * para que maquinas leiam a pagina.
 */
export function Faq({ titulo, itens }: { titulo: string; itens: ItemFaq[] }) {
  useEffect(() => {
    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.dataset.dit = "faq";
    el.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: itens.map(i => ({
        "@type": "Question",
        name: i.pergunta,
        acceptedAnswer: { "@type": "Answer", text: i.resposta },
      })),
    });
    document.head.appendChild(el);
    return () => {
      el.remove();
    };
  }, [itens]);

  return (
    <Secao titulo={titulo}>
      <div data-mo="stagger" className="divide-y border-y">
        {itens.map(i => (
          <details key={i.pergunta} className="group py-1">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-2 text-base font-medium text-tinta [&::-webkit-details-marker]:hidden">
              {i.pergunta}
              <span aria-hidden className="num text-tinta-2 group-open:hidden">+</span>
              <span aria-hidden className="num hidden text-tinta-2 group-open:inline">−</span>
            </summary>
            <p className="mo-faq-resposta max-w-prose pb-3 text-sm text-tinta-2">{i.resposta}</p>
          </details>
        ))}
      </div>
    </Secao>
  );
}
