import { useRef } from "react";
import { Link } from "wouter";
import { DimensoesTable, FAIXAS_TENSAO, PageShell, TensaoBar, botaoVariants } from "@/components/dit";
import { CurvasNivel, Palavras, VerticeGrande } from "@/components/dit/motion";
import { cn } from "@/lib/utils";
import { DIMENSOES_METODOLOGIA, PESO_ESTRUTURAL, PESO_SINAL } from "@shared/metodologia";
import type { DimensaoLeitura } from "@shared/leitura";
import BuscaLeitura from "./BuscaLeitura";
import { Faq, type ItemFaq } from "./Faq";
import { TerritoriosPublicados } from "./TerritoriosPublicados";
import { useLandingMotion } from "./inicio-motion";
import "./inicio.css";

const fmtPeso = (n: number) => n.toLocaleString("pt-BR");

// Exemplo ilustrativo da ficha (nao e um territorio real): pesos reais da metodologia,
// valores de demonstracao cuja media ponderada devolve 58.
const VALORES_EXEMPLO: Record<string, { score: number; fonte: DimensaoLeitura["fonte"] }> = {
  D1: { score: 66, fonte: "estrutural" },
  D2: { score: 49, fonte: "estrutural" },
  D3: { score: 52, fonte: "estrutural" },
  D4: { score: 68, fonte: "ambos" },
  D5: { score: 47, fonte: "estrutural" },
  D6: { score: 55, fonte: "sinal" },
};
const DIMENSOES_EXEMPLO: DimensaoLeitura[] = DIMENSOES_METODOLOGIA.filter(d => VALORES_EXEMPLO[d.id]).map(d => ({
  id: d.id,
  nome: d.nome,
  peso: d.peso,
  score: VALORES_EXEMPLO[d.id].score,
  fonte: VALORES_EXEMPLO[d.id].fonte,
  medida: true,
}));

const MOMENTOS = [
  {
    id: "entrar",
    nome: "Entrar",
    pergunta: "Vale entrar neste território?",
    entrega:
      "Marco Diagnóstico: a Tensão do território, as seis dimensões e uma nota do analista antes da decisão de investimento.",
    acao: "Pedir diagnóstico",
    href: "/diagnostico?momento=entrar",
  },
  {
    id: "operar",
    nome: "Operar",
    pergunta: "O que mudou no meu CEP desde ontem?",
    entrega: "Radar: a leitura do dia por território, o que mudou e o alerta quando um sinal verificado pesa.",
    acao: "Ver o Radar",
    href: "/radar",
  },
  {
    id: "responder",
    nome: "Responder",
    pergunta: "O que está acontecendo aqui agora?",
    entrega:
      "Diagnóstico de urgência: a leitura do território no momento em que a operação precisa responder. Toda crise tem um CEP.",
    acao: "Pedir diagnóstico",
    href: "/diagnostico?momento=responder",
  },
];

const PASSOS = [
  {
    rotulo: "1. Camada estrutural",
    titulo: "Cada território, comparado com o país",
    texto: `Indicadores oficiais viram percentil nacional. É a base da leitura e pesa ${fmtPeso(PESO_ESTRUTURAL)} na dimensão.`,
  },
  {
    rotulo: "2. Sinal verificado",
    titulo: "O que mudou, só depois de conferido",
    texto: `Notícias e registros do dia passam por um verificador. O que entra move a leitura e pesa ${fmtPeso(PESO_SINAL)}.`,
  },
  {
    rotulo: "3. Analista",
    titulo: "Um analista da PRINT revisa",
    texto: "Confere o número, escreve a nota executiva e assina a leitura.",
  },
  {
    rotulo: "4. Publicação",
    titulo: "Só o publicado chega ao cliente",
    texto: "Nenhum número sai sem publicação humana.",
  },
];

const FAQ: ItemFaq[] = [
  {
    pergunta: "De onde vêm os dados?",
    resposta:
      "A base é uma camada estrutural com indicadores oficiais comparados no país inteiro (percentil nacional). Por cima dela entram sinais do dia, que só contam depois de passar por um verificador. Cada dimensão mostra de qual das duas camadas vem.",
  },
  {
    pergunta: "Quem garante que o número está certo?",
    resposta:
      "A conta é determinística e está aberta na página de metodologia. Nenhuma leitura sai para o cliente sem a publicação de um analista da PRINT, e a Confiança diz quanto da metodologia foi de fato medido.",
  },
  {
    pergunta: "E se o meu território não tiver leitura publicada?",
    resposta:
      "Peça o diagnóstico e nós localizamos o território. Onde a cobertura de dados é insuficiente, a leitura diz isso em vez de preencher o vazio com um número.",
  },
  {
    pergunta: "Isso substitui uma consultoria territorial?",
    resposta:
      "Não substitui o trabalho de campo. Entrega, antes dele, uma leitura comparável e atualizada do território, com o que foi medido e o que não foi.",
  },
  {
    pergunta: "Quanto custa?",
    resposta:
      "O Marco Radar é por assinatura e o Marco Diagnóstico é por ticket. O valor depende do escopo, e um analista da PRINT responde ao seu pedido por e-mail.",
  },
  {
    pergunta: "Vale para qualquer operação?",
    resposta:
      "Vale para decisões que dependem do lugar: entrar, operar ou responder em um território. Se o pedido não couber na leitura, o analista diz isso no retorno.",
  },
];

const H2 = "max-w-4xl text-3xl leading-[1.08] md:text-[2.6rem]";

export default function PublicoInicio() {
  const raiz = useRef<HTMLDivElement>(null);
  useLandingMotion(raiz);

  return (
    <PageShell>
      <div ref={raiz}>
        {/* 1. Hero: a dor primeiro, curvas de nivel em movimento e o vertice que se desenha */}
        <section
          data-lp="hero"
          className="relative isolate overflow-hidden border-b"
          style={{ minHeight: "min(calc(100svh - 4rem), 62rem)" }}
        >
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute left-1/2 top-[92px] aspect-square w-[170vw] -translate-x-1/2 -translate-y-1/2 md:left-auto md:right-[-34vw] md:top-1/2 md:w-[min(105vw,1150px)] md:translate-x-0">
              <CurvasNivel aneis={18} />
              <VerticeGrande className="absolute left-1/2 top-1/2 w-[clamp(96px,13vw,200px)] -translate-x-1/2 -translate-y-1/2" />
            </div>
          </div>
          <div
            data-lp="hero-texto"
            className="container relative flex flex-col justify-center pb-16 pt-44 md:py-28"
            style={{ minHeight: "inherit" }}
          >
            <div className="max-w-[58rem] space-y-7 md:space-y-9">
              <p data-mo="up" data-mo-delay={0.1} className="nota uppercase tracking-[0.14em]">
                Inteligência territorial da PRINT
              </p>
              <Palavras
                as="h1"
                texto="Toda operação tem um *CEP.*"
                atraso={0.3}
                className="text-[clamp(2.6rem,11.4vw,3.9rem)] font-bold leading-[0.96] tracking-[-0.02em] md:text-[clamp(3.6rem,6.6vw,7.4rem)]"
              />
              <p data-mo="up" data-mo-delay={1.0} className="max-w-2xl text-lg text-tinta md:text-xl">
                Você decide entrar, operar ou responder em um território sem saber o que ele aguenta. O território
                decide. Medimos a tensão do seu CEP e dizemos o que mudou.
              </p>
              <div data-mo="up" data-mo-delay={1.15}>
                <BuscaLeitura variante="hero" />
              </div>
              <div data-mo="up" data-mo-delay={1.3} className="flex flex-wrap items-center gap-3">
                <Link
                  href="/diagnostico"
                  data-lp-magnet
                  className={cn(botaoVariants({ variant: "primario", size: "lg" }))}
                >
                  Pedir diagnóstico
                </Link>
                <a href="#como-funciona" className={cn(botaoVariants({ variant: "secundario", size: "lg" }))}>
                  Ver como a nota nasce
                </a>
              </div>
              <p data-mo="up" data-mo-delay={1.4} className="text-sm text-tinta-2">
                Já assina o Marco Radar?{" "}
                <Link href="/entrar" className="mo-link text-acento-texto">
                  Entrar
                </Link>
              </p>
            </div>
          </div>
          <div aria-hidden className="pointer-events-none absolute bottom-6 left-1/2 hidden -translate-x-1/2 md:block">
            <span className="mo-cue" />
          </div>
        </section>

        {/* 1b. O que e o Marco: a frase acende palavra a palavra com o scroll */}
        <section className="container py-24 md:py-40" aria-labelledby="o-que-e">
          <div className="max-w-[62rem] space-y-8">
            <p data-mo="up" className="nota uppercase tracking-[0.14em]">
              O que é o Marco
            </p>
            <Palavras as="h2" id="o-que-e" texto="Inteligência territorial da PRINT" className="text-2xl md:text-3xl" />
            <Palavras
              as="p"
              scrub
              texto="Reunimos e cruzamos dados de diferentes fontes sobre o território, transformando-os em inteligência para compreender o contexto e orientar decisões."
              className="font-display text-[clamp(1.6rem,3.7vw,3.4rem)] font-semibold leading-[1.12] tracking-[-0.015em]"
            />
            <p data-mo="up" className="max-w-2xl text-tinta-2">
              Para isso, o Marco publica a Tensão do território, de 0 a 100 sobre seis dimensões, sempre acompanhada da
              Confiança, que diz quanto do território foi de fato medido.
            </p>
          </div>
        </section>

        {/* 2. Os tres momentos: pin e troca no desktop, empilhado no celular */}
        <section data-lp="momentos" className="border-t bg-background" aria-labelledby="momentos">
          <div
            data-lp="stage"
            className="lp-stage container flex flex-col justify-center py-20 md:min-h-screen md:pb-16 md:pt-28"
          >
            <Palavras
              as="h2"
              id="momentos"
              texto="Três decisões dependem do lugar. Cada uma tem a sua leitura."
              className={H2}
            />
            <div className="mt-10 grid gap-10 md:mt-16 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:items-center md:gap-16">
              <div className="relative hidden md:block" aria-hidden>
                <span
                  data-lp="mom-regua"
                  className="absolute -left-6 bottom-2 top-2 w-[2px] origin-top scale-y-0 bg-acento"
                />
                <ol className="lp-nav space-y-2">
                  {MOMENTOS.map((m, i) => (
                    <li
                      key={m.id}
                      data-lp="mom-item"
                      className="font-display flex items-baseline gap-5 text-[clamp(2.6rem,5.2vw,5rem)] font-bold leading-[1.02] tracking-[-0.02em]"
                    >
                      <span className="num text-base font-normal text-tinta-2">0{i + 1}</span>
                      {m.nome}
                    </li>
                  ))}
                </ol>
              </div>
              <div className="lp-paineis grid gap-4">
                {MOMENTOS.map(m => (
                  <article
                    key={m.id}
                    data-lp="painel"
                    className="lp-painel lp-card flex flex-col gap-4 rounded-[6px] border bg-superficie p-6 md:p-10"
                  >
                    <p data-lp="painel-linha" className="nota uppercase tracking-[0.14em]">
                      {m.nome}
                    </p>
                    <h3 data-lp="painel-linha" className="text-2xl leading-[1.12] md:text-[2.1rem]">
                      {m.pergunta}
                    </h3>
                    <p data-lp="painel-linha" className="text-tinta-2 md:text-lg">
                      {m.entrega}
                    </p>
                    <Link
                      data-lp="painel-linha"
                      href={m.href}
                      className={cn(
                        botaoVariants({ variant: m.id === "operar" ? "secundario" : "primario", size: "md" }),
                        "self-start"
                      )}
                    >
                      {m.acao}
                    </Link>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 3. Como funciona: o caminho se desenha com o scroll */}
        <section
          id="como-funciona"
          data-lp="como"
          className="container scroll-mt-20 border-t py-24 md:py-36"
          aria-labelledby="como"
        >
          <Palavras
            as="h2"
            id="como"
            texto="O número nasce de dados oficiais, passa por verificação e sai com a assinatura de um analista."
            className={H2}
          />
          <div data-lp="caminho" className="relative mt-14 md:mt-20">
            <span aria-hidden className="absolute left-0 right-0 top-[14px] hidden h-[2px] bg-border md:block" />
            <span aria-hidden className="lp-linha-h absolute left-0 right-0 top-[14px] hidden h-[2px] bg-tinta md:block" />
            <span aria-hidden className="absolute bottom-3 left-[14px] top-3 w-[2px] bg-border md:hidden" />
            <span aria-hidden className="lp-linha-v absolute bottom-3 left-[14px] top-3 w-[2px] bg-tinta md:hidden" />
            <ol className="relative grid gap-12 md:grid-cols-4 md:gap-8">
              {PASSOS.map(p => (
                <li key={p.rotulo} data-lp="passo" className="lp-passo relative pl-14 md:pl-0 md:pt-14">
                  <span
                    data-lp="no"
                    aria-hidden
                    className="lp-no absolute left-0 top-0 grid h-[30px] w-[30px] place-items-center rounded-full border-2 border-border bg-background"
                  >
                    <span className="lp-no-miolo h-[10px] w-[10px] rounded-full bg-acento" />
                  </span>
                  <div className="lp-passo-texto space-y-2">
                    <p className="num text-sm text-tinta-2">{p.rotulo}</p>
                    <h3 className="text-lg md:text-xl">{p.titulo}</h3>
                    <p className="text-sm text-tinta-2 md:text-base">{p.texto}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <p data-mo="up" className="mt-12 text-sm">
            <Link href="/metodologia" className="mo-link text-acento-texto">
              Ver a metodologia completa
            </Link>
          </p>
        </section>

        {/* 4. O que o cliente recebe: a ficha se monta quando entra na tela */}
        <section className="container border-t py-24 md:py-36" aria-labelledby="recebe">
          <Palavras
            as="h2"
            id="recebe"
            texto="Você recebe dois números: quanto o território pressiona e quanto sabemos dele."
            className={H2}
          />
          <div className="mt-10 grid gap-10 md:mt-16 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-16">
            <div data-mo="stagger" className="space-y-8 text-tinta-2">
              <div>
                <h3 className="text-xl text-tinta">Tensão</h3>
                <p className="mt-2">
                  De 0 a 100. Quanto maior, mais o território pressiona a operação. Vem com a faixa e o rótulo:
                </p>
                <p className="mt-1 text-tinta">{FAIXAS_TENSAO.map(f => f.rotulo).join(", ")}.</p>
              </div>
              <div>
                <h3 className="text-xl text-tinta">Confiança</h3>
                <p className="mt-2">
                  Quanto da metodologia foi de fato medido. Confiança baixa alarga a faixa: o Marco mostra o que não
                  sabe em vez de esconder.
                </p>
              </div>
            </div>
            <div data-lp="ficha" className="space-y-8 rounded-[6px] border bg-superficie p-5 md:p-8">
              <p className="nota uppercase tracking-wide">
                Exemplo ilustrativo, não é um território real. Valores de demonstração.
              </p>
              {/* Valores fixos apenas para ensinar a ler a ficha; o rótulo acima os marca como exemplo. */}
              <TensaoBar tensao={58} faixa={{ min: 46, max: 71 }} confianca={72} />
              <DimensoesTable dimensoes={DIMENSOES_EXEMPLO} />
            </div>
          </div>
        </section>

        {/* 5. Territorios com leitura (o bloco some se a procedure nao devolver nada) */}
        <div className="container">
          <TerritoriosPublicados titulo="Territórios com leitura agora" />
        </div>

        {/* 6. Dois produtos, sem preco */}
        <section className="container border-t py-24 md:py-36" aria-labelledby="produtos">
          <Palavras
            as="h2"
            id="produtos"
            texto="Dois jeitos de usar o Marco: por assinatura ou por pedido."
            className={H2}
          />
          <div data-mo="stagger" className="mt-10 grid gap-4 md:mt-14 md:grid-cols-2">
            <article className="lp-card flex flex-col gap-3 rounded-[6px] border bg-superficie p-6 md:p-8">
              <p className="nota uppercase tracking-wide">Assinatura</p>
              <h3 className="text-2xl">Marco Radar</h3>
              <p className="flex-1 text-tinta-2">
                Você abre o Marco Radar e sabe o que mudou no seu CEP antes do jornal. Leitura diária dos seus
                territórios, nota do analista e alerta quando um sinal verificado pesa.
              </p>
              <Link href="/radar" className={cn(botaoVariants({ variant: "secundario", size: "md" }), "self-start")}>
                Ver o Marco Radar
              </Link>
            </article>
            <article className="lp-card flex flex-col gap-3 rounded-[6px] border bg-superficie p-6 md:p-8">
              <p className="nota uppercase tracking-wide">Por ticket</p>
              <h3 className="text-2xl">Marco Diagnóstico</h3>
              <p className="flex-1 text-tinta-2">
                Leitura completa de um território para uma decisão: Tensão e Confiança, as seis dimensões, atores,
                cenários e nota executiva.
              </p>
              <Link
                href="/diagnostico"
                className={cn(botaoVariants({ variant: "primario", size: "md" }), "self-start")}
              >
                Pedir diagnóstico
              </Link>
            </article>
          </div>
        </section>

        {/* 7. FAQ como matriz de objecoes */}
        <section className="container border-t py-20 md:py-28">
          <Faq titulo="O que quem decide costuma perguntar" itens={FAQ} />
        </section>

        {/* 8. CTA final (ancora usada pelo header): as curvas respiram atras da frase */}
        <section
          id="pedir-diagnostico"
          data-lp="cta"
          className="relative isolate scroll-mt-20 overflow-hidden border-t bg-card py-28 md:py-44"
        >
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center">
            <div className="relative aspect-square w-[150vw] md:w-[min(90vw,1100px)]">
              <CurvasNivel aneis={15} />
            </div>
          </div>
          <div className="container relative space-y-7">
            <Palavras
              as="h2"
              texto="Decida com a leitura do território na mão."
              className="max-w-4xl text-[clamp(2.2rem,6.4vw,6rem)] font-bold leading-[1.0] tracking-[-0.02em]"
            />
            <p data-mo="up" className="max-w-prose text-tinta-2 md:text-lg">
              Diga o território e a decisão. Um analista da PRINT responde por e-mail.
            </p>
            <div data-mo="up">
              <Link
                href="/diagnostico"
                data-lp-magnet
                className={cn(botaoVariants({ variant: "primario", size: "lg" }), "inline-flex")}
              >
                Pedir diagnóstico
              </Link>
            </div>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
