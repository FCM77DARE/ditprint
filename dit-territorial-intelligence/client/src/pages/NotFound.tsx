import { Link } from "wouter";
import { PageShell, botaoVariants } from "@/components/dit";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <PageShell>
      <div className="container py-16">
        <h1 className="max-w-prose text-3xl font-semibold text-tinta">Esta página não existe ou mudou de endereço.</h1>
        <p className="mt-3 max-w-prose text-tinta-2">
          Confira o endereço digitado ou volte ao início para seguir pelo menu.
        </p>
        <Link href="/" className={cn(botaoVariants({ variant: "primario" }), "mt-6 inline-flex")}>
          Voltar ao início
        </Link>
      </div>
    </PageShell>
  );
}
