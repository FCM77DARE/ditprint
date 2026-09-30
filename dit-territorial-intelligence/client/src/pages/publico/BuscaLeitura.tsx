import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useLocation } from "wouter";
import { Search } from "lucide-react";
import { Button } from "@/components/dit";
import { cn } from "@/lib/utils";
import { buscarEstrutural, buscarSugestoes } from "@/lib/leitura-ao-vivo";
import type { Municipio } from "@/lib/leitura-estado";

/**
 * Campo da primeira leitura: a isca do funil. A pessoa digita um território e
 * cai em /leitura/:slug, onde a leitura estrutural sai na hora e a leitura ao
 * vivo vem em seguida.
 *
 * Autocomplete com o dado local da camada estrutural (GET /api/dit/estrutural/
 * sugestoes). Homônimo pede o estado; nome que não existe mostra sugestões em
 * vez de um palpite. Padrão combobox (ARIA): setas, Enter, Esc.
 */

type Variante = "hero" | "compacta";

type Aviso =
  | { tipo: "ambiguo"; detalhe: string; opcoes: Municipio[] }
  | { tipo: "nao_encontrado"; detalhe: string; sugestoes: Municipio[] }
  | { tipo: "erro"; detalhe: string };

function rotulo(m: Municipio): string {
  return m.uf ? `${m.nome}, ${m.uf}` : m.nome;
}

export default function BuscaLeitura({ variante = "hero" }: { variante?: Variante }) {
  const [, navegar] = useLocation();
  const id = useId();
  const listaId = `${id}-lista`;
  const avisoId = `${id}-aviso`;
  const campo = useRef<HTMLInputElement>(null);

  const [texto, setTexto] = useState("");
  const [sugestoes, setSugestoes] = useState<Municipio[]>([]);
  const [aberta, setAberta] = useState(false);
  const [ativa, setAtiva] = useState(-1);
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState<Aviso | null>(null);

  const hero = variante === "hero";

  // Autocomplete: espera a pessoa parar de digitar e cancela a busca anterior.
  useEffect(() => {
    const q = texto.trim();
    if (q.length < 2) {
      setSugestoes([]);
      return;
    }
    const ctl = new AbortController();
    const t = window.setTimeout(() => {
      void buscarSugestoes(q, ctl.signal).then((s) => {
        if (ctl.signal.aborted) return;
        setSugestoes(s);
        setAtiva(-1);
      });
    }, 180);
    return () => {
      window.clearTimeout(t);
      ctl.abort();
    };
  }, [texto]);

  function ir(m: Municipio) {
    setAberta(false);
    setAviso(null);
    navegar(`/leitura/${m.slug}`);
  }

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    const q = texto.trim();
    if (q.length < 2) {
      setAviso({ tipo: "erro", detalhe: "Digite o nome do município, com pelo menos 2 letras." });
      campo.current?.focus();
      return;
    }
    if (ativa >= 0 && sugestoes[ativa]) {
      ir(sugestoes[ativa]);
      return;
    }
    setBuscando(true);
    setAberta(false);
    setAviso(null);
    const r = await buscarEstrutural(q);
    setBuscando(false);
    if (r.tipo === "ok") navegar(`/leitura/${r.leitura.municipio.slug}`);
    else if (r.tipo === "ambiguo") setAviso({ tipo: "ambiguo", detalhe: r.detalhe, opcoes: r.opcoes });
    else if (r.tipo === "nao_encontrado") setAviso({ tipo: "nao_encontrado", detalhe: r.detalhe, sugestoes: r.sugestoes });
    else if (r.detalhe) setAviso({ tipo: "erro", detalhe: r.detalhe });
  }

  function teclado(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (sugestoes.length === 0) return;
      setAberta(true);
      setAtiva((i) => (i + 1) % sugestoes.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (sugestoes.length === 0) return;
      setAberta(true);
      setAtiva((i) => (i <= 0 ? sugestoes.length - 1 : i - 1));
    } else if (e.key === "Escape") {
      setAberta(false);
      setAtiva(-1);
    }
  }

  const mostraLista = aberta && sugestoes.length > 0;

  return (
    <div className={cn("w-full", hero ? "max-w-2xl" : "max-w-xl")}>
      <form onSubmit={enviar} role="search" aria-label="Primeira leitura" className="space-y-2">
        <label htmlFor={`${id}-campo`} className={cn("block font-medium text-tinta", hero ? "text-base md:text-lg" : "text-sm")}>
          Qual território você precisa ler?
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search
              size={hero ? 20 : 16}
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tinta-2"
            />
            <input
              ref={campo}
              id={`${id}-campo`}
              type="text"
              role="combobox"
              aria-expanded={mostraLista}
              aria-controls={listaId}
              aria-autocomplete="list"
              aria-activedescendant={ativa >= 0 ? `${id}-op-${ativa}` : undefined}
              aria-describedby={aviso ? avisoId : `${id}-dica`}
              aria-invalid={aviso?.tipo === "erro" ? true : undefined}
              autoComplete="off"
              spellCheck={false}
              maxLength={120}
              placeholder="Macaé, RJ"
              value={texto}
              onChange={(e) => {
                setTexto(e.target.value);
                setAberta(true);
                setAviso(null);
              }}
              onFocus={() => setAberta(true)}
              onBlur={() => window.setTimeout(() => setAberta(false), 120)}
              onKeyDown={teclado}
              className={cn(
                "w-full rounded-[2px] border border-tinta-2 bg-superficie pl-10 pr-3 text-tinta placeholder:text-tinta-2",
                hero ? "min-h-14 text-lg" : "min-h-11 text-base"
              )}
            />
            {mostraLista && (
              <ul
                id={listaId}
                role="listbox"
                aria-label="Municípios sugeridos"
                className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-auto rounded-[2px] border bg-card"
              >
                {sugestoes.map((m, i) => (
                  <li
                    key={m.ibgeId}
                    id={`${id}-op-${i}`}
                    role="option"
                    aria-selected={i === ativa}
                    // mouseDown, não click: o blur do campo fecharia a lista antes do click.
                    onMouseDown={(e) => {
                      e.preventDefault();
                      ir(m);
                    }}
                    className={cn(
                      "flex min-h-11 cursor-pointer items-center justify-between gap-3 px-3 text-base text-tinta",
                      i === ativa ? "bg-muted" : "hover:bg-muted"
                    )}
                  >
                    <span>{m.nome}</span>
                    <span className="nota">{m.uf}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Button type="submit" size={hero ? "lg" : "md"} disabled={buscando} className="sm:min-w-44">
            {buscando ? "Procurando" : "Ler este território"}
          </Button>
        </div>
        {!aviso && (
          <p id={`${id}-dica`} className="nota">
            Município, com o estado se houver homônimo. A leitura estrutural sai na hora, sem cadastro.
          </p>
        )}
      </form>

      {aviso && (
        <div id={avisoId} role="status" aria-live="polite" className="mt-3 space-y-2 border-l-2 pl-3" style={{ borderColor: "var(--acento)" }}>
          <p className="text-sm text-tinta">{aviso.detalhe}</p>
          {aviso.tipo === "ambiguo" && (
            <ul className="flex flex-wrap gap-2">
              {aviso.opcoes.map((m) => (
                <li key={m.ibgeId}>
                  <Button variant="secundario" size="sm" onClick={() => ir(m)}>
                    {rotulo(m)}
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {aviso.tipo === "nao_encontrado" && aviso.sugestoes.length > 0 && (
            <div className="space-y-1">
              <p className="nota">Você quis dizer:</p>
              <ul className="flex flex-wrap gap-2">
                {aviso.sugestoes.map((m) => (
                  <li key={m.ibgeId}>
                    <Button variant="secundario" size="sm" onClick={() => ir(m)}>
                      {rotulo(m)}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {aviso.tipo === "nao_encontrado" && aviso.sugestoes.length === 0 && (
            <Button
              variant="fantasma"
              size="sm"
              onClick={() => navegar(`/leitura/${encodeURIComponent(texto.trim())}`)}
            >
              Tentar assim mesmo
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
