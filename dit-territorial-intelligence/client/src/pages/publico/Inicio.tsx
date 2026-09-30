import { Link } from "wouter";
import { FAIXAS_TENSAO, PageShell, TensaoBar, botaoVariants } from "@/components/dit";
import { cn } from "@/lib/utils";
import { PESO_ESTRUTURAL, PESO_SINAL } from "@shared/metodologia";
import { Faq, type ItemFaq } from "./Faq";
import { TerritoriosPublicados } from "./TerritoriosPublicados";

const fmtPeso = (n: number) => n.toLocaleString("pt-BR");

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

export default function PublicoInicio() {
  return (
    <PageShell hero>
      {/* 1. Hero: a dor primeiro */}
      <section className="container py-14 md:py-24">
        <div className="max-w-3xl space-y-6">
          <h1 className="text-4xl md:text-6xl">Toda operação tem um CEP.</h1>
          <p className="max-w-2xl text-lg text-tinta">
            Você decide entrar, operar ou responder em um território sem saber o que ele aguenta. O território decide.
            Medimos a tensão do seu CEP e dizemos o que mudou.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/diagnostico" className={cn(botaoVariants({ variant: "primario", size: "lg" }))}>
              Pedir diagnóstico
            </Link>
            <a href="#como-funciona" className={cn(botaoVariants({ variant: "secundario", size: "lg" }))}>
              Ver como a nota nasce
            </a>
          </div>
          <p className="text-sm text-tinta-2">
            Já assina o Marco Radar?{" "}
            <Link href="/entrar" className="text-acento-texto underline underline-offset-4">
              Entrar
            </Link>
          </p>
        </div>
      </section>

      <div className="space-y-14 border-t bg-background pb-16 pt-14 md:space-y-20 md:pb-24 md:pt-20">
        {/* 1b. O que é o Marco */}
        <section className="container" aria-labelledby="o-que-e">
          <div className="max-w-3xl space-y-3">
            <p className="nota uppercase tracking-wide">O que é o Marco</p>
            <h2 id="o-que-e" className="text-2xl">
              Inteligência territorial da PRINT
            </h2>
            <p className="text-tinta-2">
              Reunimos e cruzamos dados de diferentes fontes sobre o território, transformando-os em inteligência para
              compreender o contexto e orientar decisões.
            </p>
            <p className="text-tinta-2">
              Para isso, o Marco publica a Tensão do território, de 0 a 100 sobre seis dimensões, sempre
              acompanhada da Confiança, que diz quanto do território foi de fato medido.
            </p>
          </div>
        </section>

        {/* 2. Os três momentos */}
        <section className="container" aria-labelledby="momentos">
          <h2 id="momentos" className="text-2xl">
            Três decisões dependem do lugar. Cada uma tem a sua leitura.
          </h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {MOMENTOS.map(m => (
              <article key={m.id} className="flex flex-col gap-3 rounded-[6px] border bg-superficie p-5">
                <p className="nota uppercase tracking-wide">{m.nome}</p>
                <h3 className="text-lg">{m.pergunta}</h3>
                <p className="flex-1 text-sm text-tinta-2">{m.entrega}</p>
                <Link
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
        </section>

        {/* 3. Como funciona */}
        <section id="como-funciona" className="container scroll-mt-20" aria-labelledby="como">
          <h2 id="como" className="text-2xl">
            O número nasce de dados oficiais, passa por verificação e sai com a assinatura de um analista.
          </h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-3">
            <li className="space-y-2 border-t-2 border-tinta pt-4">
              <p className="num text-sm text-tinta-2">1. Camada estrutural</p>
              <h3 className="text-lg">Cada território, comparado com o país</h3>
              <p className="text-sm text-tinta-2">
                Indicadores oficiais viram percentil nacional. É a base da leitura e pesa {fmtPeso(PESO_ESTRUTURAL)} na
                dimensão.
              </p>
            </li>
            <li className="space-y-2 border-t-2 border-tinta pt-4">
              <p className="num text-sm text-tinta-2">2. Sinais verificados</p>
              <h3 className="text-lg">O que mudou, só depois de conferido</h3>
              <p className="text-sm text-tinta-2">
                Notícias e registros do dia passam por um verificador. O que entra move a leitura e pesa{" "}
                {fmtPeso(PESO_SINAL)}.
              </p>
            </li>
            <li className="space-y-2 border-t-2 border-tinta pt-4">
              <p className="num text-sm text-tinta-2">3. Nota do analista</p>
              <h3 className="text-lg">Nenhum número sai sem publicação humana</h3>
              <p className="text-sm text-tinta-2">
                Um analista da PRINT revisa, escreve a nota executiva e publica. Só o publicado chega ao cliente.
              </p>
            </li>
          </ol>
          <p className="mt-4 text-sm">
            <Link href="/metodologia" className="text-acento-texto underline underline-offset-4">
              Ver a metodologia completa
            </Link>
          </p>
        </section>

        {/* 4. O que o cliente recebe */}
        <section className="container" aria-labelledby="recebe">
          <h2 id="recebe" className="text-2xl">
            Você recebe dois números: quanto o território pressiona e quanto sabemos dele.
          </h2>
          <div className="mt-6 grid gap-8 md:grid-cols-2">
            <div className="space-y-4 text-sm text-tinta-2">
              <div>
                <h3 className="text-lg text-tinta">Tensão</h3>
                <p>De 0 a 100. Quanto maior, mais o território pressiona a operação. Vem com a faixa e o rótulo:</p>
                <p className="mt-1 text-tinta">{FAIXAS_TENSAO.map(f => f.rotulo).join(", ")}.</p>
              </div>
              <div>
                <h3 className="text-lg text-tinta">Confiança</h3>
                <p>
                  Quanto da metodologia foi de fato medido. Confiança baixa alarga a faixa: o Marco mostra o que não sabe
                  em vez de esconder.
                </p>
              </div>
            </div>
            <div className="space-y-2 rounded-[6px] border bg-superficie p-5">
              <p className="nota uppercase tracking-wide">Exemplo ilustrativo, não é um território real</p>
              {/* Valores fixos apenas para ensinar a ler a barra; o rótulo acima os marca como exemplo. */}
              <TensaoBar tensao={58} faixa={{ min: 46, max: 71 }} confianca={72} />
            </div>
          </div>
        </section>

        {/* 5. Territórios com leitura (o bloco some se a procedure não devolver nada) */}
        <div className="container">
          <TerritoriosPublicados titulo="Territórios com leitura agora" />
        </div>

        {/* 6. Dois produtos, sem preço */}
        <section className="container" aria-labelledby="produtos">
          <h2 id="produtos" className="text-2xl">
            Dois jeitos de usar o Marco: por assinatura ou por pedido.
          </h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <article className="flex flex-col gap-3 rounded-[6px] border bg-superficie p-5">
              <p className="nota uppercase tracking-wide">Assinatura</p>
              <h3 className="text-xl">Marco Radar</h3>
              <p className="flex-1 text-sm text-tinta-2">
                Você abre o Marco Radar e sabe o que mudou no seu CEP antes do jornal. Leitura diária dos seus territórios,
                nota do analista e alerta quando um sinal verificado pesa.
              </p>
              <Link href="/radar" className={cn(botaoVariants({ variant: "secundario", size: "md" }), "self-start")}>
                Ver o Marco Radar
              </Link>
            </article>
            <article className="flex flex-col gap-3 rounded-[6px] border bg-superficie p-5">
              <p className="nota uppercase tracking-wide">Por ticket</p>
              <h3 className="text-xl">Marco Diagnóstico</h3>
              <p className="flex-1 text-sm text-tinta-2">
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

        {/* 7. FAQ como matriz de objeções */}
        <section className="container">
          <Faq titulo="O que quem decide costuma perguntar" itens={FAQ} />
        </section>

        {/* 8. CTA final (âncora usada pelo header) */}
        <section id="pedir-diagnostico" className="container scroll-mt-20">
          <div className="space-y-4 border-t pt-10">
            <h2 className="text-3xl">Decida com a leitura do território na mão.</h2>
            <p className="max-w-prose text-tinta-2">
              Diga o território e a decisão. Um analista da PRINT responde por e-mail.
            </p>
            <Link href="/diagnostico" className={cn(botaoVariants({ variant: "primario", size: "lg" }))}>
              Pedir diagnóstico
            </Link>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
