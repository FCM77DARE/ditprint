import { botaoVariants } from "@/components/dit";

/** Link com a cara de botao do sistema (usa a mesma variante, sem criar estilo novo). */
export function buttonLinkClass(variant: "primario" | "secundario" | "fantasma", size: "sm" | "md" = "sm") {
  return botaoVariants({ variant, size });
}
