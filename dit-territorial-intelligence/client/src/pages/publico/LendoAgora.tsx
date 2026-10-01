import { useEffect, useRef, useState } from "react";
import { Vertice } from "./MarcoShell";

/**
 * O que o Marco está lendo agora: manchetes reais que as fontes devolvem enquanto
 * as pessoas pesquisam territórios e a coleta do dia roda (GET /api/dit/lendo-agora).
 * É o gesto próprio do produto. Nenhum item é fixo: sem conexão, a tela diz isso.
 */
interface Item {
  territorio: string;
  slug: string;
  dimensao: string;
  manchete: string;
  fonte: string | null;
  data: string | null;
  lidoEm: string;
}

const DIM: Record<string, string> = {
  D1: "Socioambiental", D2: "Socioeconômica", D3: "Infraestrutura", D4: "Dinâmica territorial",
  D5: "Governança", D6: "Reputação", GERAL: "Geral",
};

function haQuanto(iso: string, agora: number): string {
  const s = Math.max(0, Math.round((agora - new Date(iso).getTime()) / 1000));
  if (s < 60) return "agora";
  const m = Math.round(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.round(h / 24)} d`;
}

export function LendoAgora() {
  const [itens, setItens] = useState<Item[]>([]);
  const [estado, setEstado] = useState<"conectando" | "ao_vivo" | "fora">("conectando");
  const [agora, setAgora] = useState(Date.now());
  const novos = useRef(new Set<string>());

  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/dit/lendo-agora");
    } catch {
      setEstado("fora");
      return;
    }
    es.onopen = () => setEstado("ao_vivo");
    es.onerror = () => setEstado(e => (e === "ao_vivo" ? "ao_vivo" : "fora"));
    es.onmessage = ev => {
      try {
        const it = JSON.parse(ev.data) as Item;
        const k = `${it.slug}|${it.manchete}`;
        novos.current.add(k);
        window.setTimeout(() => novos.current.delete(k), 2400);
        setItens(lista => [it, ...lista.filter(x => `${x.slug}|${x.manchete}` !== k)].slice(0, 12));
        setEstado("ao_vivo");
      } catch {
        /* evento malformado */
      }
    };
    const t = window.setInterval(() => setAgora(Date.now()), 30000);
    return () => { es?.close(); window.clearInterval(t); };
  }, []);

  const territorios = new Set(itens.map(i => i.slug)).size;

  return (
    <div className="lendo">
      <div className="lendo-topo">
        <span className={`lendo-sinal ${estado}`}><i />{estado === "ao_vivo" ? "Ao vivo" : estado === "conectando" ? "Conectando" : "Sem conexão"}</span>
        {itens.length > 0 && <span className="lendo-conta">{itens.length} manchetes de {territorios} {territorios === 1 ? "território" : "territórios"}</span>}
      </div>
      {itens.length === 0 ? (
        <p className="lendo-vazio">
          {estado === "fora"
            ? "O feed não respondeu agora. Pesquise um território acima e veja a leitura acontecer."
            : "Esperando a próxima manchete. Quando alguém pesquisa um território, ela aparece aqui."}
        </p>
      ) : (
        <ol className="lendo-lista" aria-live="polite">
          {itens.map(it => {
            const k = `${it.slug}|${it.manchete}`;
            return (
              <li key={k} className={novos.current.has(k) ? "novo" : ""}>
                <Vertice fixo />
                <div>
                  <p className="lendo-meta"><b>{it.territorio}</b><span>{DIM[it.dimensao] ?? it.dimensao}</span>{it.fonte && <span>{it.fonte}</span>}<span>{haQuanto(it.lidoEm, agora)}</span></p>
                  <p className="lendo-manchete">{it.manchete}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
