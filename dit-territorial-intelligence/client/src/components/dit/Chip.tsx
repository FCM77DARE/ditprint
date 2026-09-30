import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Chip/Tag: unico lugar onde o formato pill e permitido. */
export function Chip({
  children,
  tom = "neutro",
  className,
}: {
  children: ReactNode;
  tom?: "neutro" | "acento" | "contorno";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        tom === "neutro" && "bg-muted text-tinta",
        tom === "acento" && "bg-acento text-[var(--acento-fg)]",
        tom === "contorno" && "border text-tinta-2",
        className
      )}
    >
      {children}
    </span>
  );
}
