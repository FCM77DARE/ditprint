import { Link } from "wouter";
import { PageShell, Secao, botaoVariants } from "@/components/dit";
import { cn } from "@/lib/utils";
import { LIMITE_ALERTA } from "@shared/metodologia";
import { Faq, type ItemFaq } from "./Faq";
import { TerritoriosPublicados } from "./TerritoriosPublicados";

const ENTREGAS = [
  {
    nome: "Leitura do dia",
    texto: "A tensão e a confiança de cada território que você acompanha, com a faixa e a variação em 7 e 30 dias.",
  },
  {
    nome: "Nota executiva",
    texto: "Duas frases do analista: o que mudou, por quê e o que observar.",
  },
  {
    nome: "Alerta",
    texto: `Aviso quando um sinal verificado passa de ${LIMITE_ALERTA.toLocaleString("pt-BR")} de impacto, sem esperar a leitura do dia.`,
  },
  {
    nome: "Portal",
    texto: "Uma tabela só, com todos os seus territórios, para você entender o dia em poucos segundos.",
  },
];

const FAQ: ItemFaq[] = [
  {
    pergunta: "Quem publica a leitura que eu recebo?",
    resposta: "Um analista da PRINT revisa e publica. Só o que foi publicado chega ao portal e aos alertas.",
  },
  {
    pergunta: "Posso acompanhar qualquer território?",
    resposta:
      "Você escolhe os territórios no pedido. Onde a cobertura de dados é insuficiente, o Marco Radar diz isso em vez de mostrar um número sem base.",
  },
  {
    pergunta: "Qual a diferença para o Marco Diagnóstico?",
    resposta:
      "O Marco Radar é a leitura contínua, por assinatura. O Marco Diagnóstico é a leitura completa de um território para uma decisão, por ticket.",
  },
  {
    pergunta: "Quanto custa?",
    resposta: "O valor depende de quantos territórios você acompanha. Um analista da PRINT responde ao seu pedido por e-mail.",
  },
];

export default function PublicoRadar() {
  return (
    <PageShell>
      <div className="container max-w-4xl space-y-12 py-12 md:py-16">
        <header className="space-y-4">
          <h1 className="text-3xl md:text-4xl">Você abre o Marco Radar e sabe o que mudou no seu CEP antes do jornal.</h1>
          <p className="max-w-prose text-tinta-2">
            Quando o território muda, quem descobre pela imprensa já está atrasado. O Marco Radar entrega a leitura dos seus
            territórios todos os dias, com a assinatura de um analista.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/diagnostico?interesse=radar"
              className={cn(botaoVariants({ variant: "primario", size: "lg" }))}
            >
              Pedir acesso ao Marco Radar
            </Link>
            <Link href="/entrar" className={cn(botaoVariants({ variant: "secundario", size: "lg" }))}>
              Entrar
            </Link>
          </div>
        </header>

        <Secao titulo="O que chega para você, todos os dias.">
          <ul className="grid gap-4 md:grid-cols-2">
            {ENTREGAS.map(e => (
              <li key={e.nome} className="space-y-1 border-t-2 border-tinta pt-3">
                <h3 className="text-lg">{e.nome}</h3>
                <p className="text-sm text-tinta-2">{e.texto}</p>
              </li>
            ))}
          </ul>
        </Secao>

        <TerritoriosPublicados titulo="Territórios com leitura agora" />

        <Secao titulo="Nenhum número chega ao Marco Radar sem a publicação de um analista.">
          <p className="max-w-prose text-sm text-tinta-2">
            A leitura soma seis dimensões, com a camada estrutural nacional e os sinais verificados do dia.{" "}
            <Link href="/metodologia" className="text-acento-texto underline underline-offset-4">
              Ver a metodologia
            </Link>
          </p>
        </Secao>

        <Faq titulo="O que quem acompanha territórios costuma perguntar" itens={FAQ} />

        <div className="space-y-3 border-t pt-8">
          <h2 className="text-2xl">Acompanhe o seu CEP todos os dias.</h2>
          <Link
            href="/diagnostico?interesse=radar"
            className={cn(botaoVariants({ variant: "primario", size: "lg" }))}
          >
            Pedir acesso ao Marco Radar
          </Link>
        </div>
      </div>
    </PageShell>
  );
}
