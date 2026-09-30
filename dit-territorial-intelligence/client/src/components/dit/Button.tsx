import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Botao do Marco. Primario = bronze, com verbo de acao. Secundario = contorno.
 * Fantasma = so texto. Sem sombra, sem gradiente, transicao so de cor/opacidade.
 */
export const botaoVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[2px] font-medium transition-[background-color,border-color,opacity] duration-[var(--dur)] disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primario: "bg-acento text-[var(--acento-fg)] hover:opacity-90",
        secundario: "border border-tinta-2 bg-transparent text-tinta hover:bg-muted",
        fantasma: "bg-transparent text-tinta hover:bg-muted",
      },
      size: {
        sm: "min-h-9 px-3 text-sm",
        md: "min-h-11 px-4 text-sm",
        lg: "min-h-12 px-6 text-base",
      },
    },
    defaultVariants: { variant: "primario", size: "md" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof botaoVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button ref={ref} type={type} className={cn(botaoVariants({ variant, size }), className)} {...props} />
  )
);
Button.displayName = "Button";
