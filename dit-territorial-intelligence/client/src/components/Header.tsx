/**
 * Header Component
 * Design: PRINT Brandbook — Verde Floresta, Off-white, Nunito
 * - Suporta light/dark mode
 * - Tipografia: Nunito ExtraBold para logo
 * - Toggle elegante para alternar temas
 */

import { Link } from "wouter";
import { Button } from "./ui/button";
import { Zap, Sun, Moon, LayoutDashboard, Map } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

export default function Header() {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="fixed top-0 z-50 w-full border-b border-border/40 glass">
      <div className="container">
        <div className="flex h-20 items-center justify-between">
          {/* Logo */}
          <Link href="/">
            <div className="flex items-center gap-3 transition-all hover:opacity-80">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20 glow">
                <Zap className="h-5 w-5 text-primary" fill="currentColor" />
              </div>
              <div className="flex flex-col">
                <span className="font-display text-xl font-bold leading-none tracking-tight text-foreground">
                  PRINT
                </span>
                <span className="font-mono text-[9px] font-medium leading-none tracking-widest text-accent">
                  TERRITORIAL INTELLIGENCE
                </span>
              </div>
            </div>
          </Link>

          {/* Navigation */}
          <nav className="hidden items-center gap-8 md:flex">
            <Link href="/" className="font-body text-sm font-medium text-muted-foreground transition-all hover:text-foreground hover:text-glow">
              Territórios
            </Link>
            <Link href="/sse" className="font-body text-sm font-medium text-muted-foreground transition-all hover:text-foreground hover:text-glow">
              SSE™
            </Link>
            <Link href="/metodologia" className="font-body text-sm font-medium text-muted-foreground transition-all hover:text-foreground hover:text-glow">
              Metodologia
            </Link>
            <Link href="/radar" className="font-body text-sm font-medium text-muted-foreground transition-all hover:text-foreground hover:text-glow">
              Radar™
            </Link>
            <Link href="/sobre" className="font-body text-sm font-medium text-muted-foreground transition-all hover:text-foreground hover:text-glow">
              Sobre
            </Link>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-3">
            {/* Theme Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              className="h-9 w-9 rounded-lg p-0 transition-all hover:bg-accent/10 hover:scale-105"
              aria-label="Alternar tema"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4 text-accent" />
              ) : (
                <Moon className="h-4 w-4 text-accent" />
              )}
            </Button>

            {/* Dev Hub — local only */}
            <Link href="/dev">
              <Button
                variant="ghost"
                size="sm"
                className="hidden md:flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 border border-dashed border-border/40 hover:border-border/80"
              >
                <Map className="h-3.5 w-3.5" />
                DEV
              </Button>
            </Link>

            {/* Dashboard Access */}
            <Link href="/dashboard">
              <Button
                variant="outline"
                size="sm"
                className="hidden md:flex items-center gap-1.5 border-primary/40 font-body text-sm font-semibold text-primary transition-all hover:scale-105 hover:border-primary hover:bg-primary/10"
              >
                <LayoutDashboard className="h-3.5 w-3.5" />
                Dashboard
              </Button>
            </Link>

            {/* CTA */}
            <Button
              size="sm"
              className="glow bg-primary font-body text-sm font-semibold text-primary-foreground transition-all hover:scale-105 hover:bg-primary/90"
            >
              Agendar conversa
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
