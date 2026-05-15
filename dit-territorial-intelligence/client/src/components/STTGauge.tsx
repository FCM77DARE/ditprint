/**
 * STTGauge Component
 * Design: PRINT Brandbook — Verde Floresta, Dourado, Nunito
 * - Gauge circular com glow effects
 * - Animação suave com counter effect
 * - Tipografia: Nunito ExtraBold para score
 */

import { useEffect, useState } from "react";

interface STTGaugeProps {
  score: number; // 0-100
  label: string;
  subtitle?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

export default function STTGauge({
  score,
  label,
  subtitle,
  size = "md",
}: STTGaugeProps) {
  const [animatedScore, setAnimatedScore] = useState(0);

  // Size configurations
  const sizeConfig = {
    sm: { radius: 50, strokeWidth: 6, fontSize: "text-2xl", containerSize: "w-32 h-32" },
    md: { radius: 70, strokeWidth: 8, fontSize: "text-4xl", containerSize: "w-44 h-44" },
    lg: { radius: 90, strokeWidth: 10, fontSize: "text-5xl", containerSize: "w-56 h-56" },
    xl: { radius: 120, strokeWidth: 12, fontSize: "text-7xl", containerSize: "w-72 h-72" },
  };

  const config = sizeConfig[size];
  const circumference = 2 * Math.PI * config.radius;
  const offset = circumference - (animatedScore / 100) * circumference;

  // Determine complexity level and color — PRINT brandbook palette
  const getComplexityLevel = (score: number) => {
    if (score >= 70) return {
      text: "Alta Complexidade",
      color: "oklch(0.72 0.09 60)",   // Dourado #D4A574
      glowClass: "glow-gold",
    };
    if (score >= 40) return {
      text: "Média Complexidade",
      color: "oklch(0.33 0.07 155)",  // Verde Floresta #2D5340
      glowClass: "glow",
    };
    return {
      text: "Baixa Complexidade",
      color: "oklch(0.59 0.07 155)",  // Verde Sálvia #6B9B7C
      glowClass: "",
    };
  };

  const complexity = getComplexityLevel(score);

  // Animate score on mount
  useEffect(() => {
    const duration = 2000;
    const steps = 80;
    const increment = score / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= score) {
        setAnimatedScore(score);
        clearInterval(timer);
      } else {
        setAnimatedScore(Math.floor(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [score]);

  const svgSize = (config.radius + config.strokeWidth + 10) * 2;

  return (
    <div className="flex flex-col items-center gap-6">
      {/* SVG Gauge */}
      <div className={`relative ${config.containerSize} ${complexity.glowClass}`}>
        <svg
          width={svgSize}
          height={svgSize}
          className="absolute inset-0 rotate-[-90deg] transform"
        >
          {/* Background circle */}
          <circle
            cx={svgSize / 2}
            cy={svgSize / 2}
            r={config.radius}
            fill="none"
            stroke="oklch(0.83 0.02 75)"
            strokeWidth={config.strokeWidth}
          />
          {/* Animated progress circle */}
          <circle
            cx={svgSize / 2}
            cy={svgSize / 2}
            r={config.radius}
            fill="none"
            stroke={complexity.color}
            strokeWidth={config.strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
            style={{
              filter: `drop-shadow(0 0 8px ${complexity.color})`,
            }}
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span 
            className={`font-display ${config.fontSize} font-bold leading-none text-foreground text-glow`}
          >
            {animatedScore}
          </span>
          <span className="mt-1 font-mono text-xs font-semibold uppercase tracking-widest text-accent">
            STT
          </span>
        </div>
      </div>

      {/* Labels */}
      <div className="flex flex-col items-center gap-2 text-center">
        <h3 className="font-display text-2xl font-bold leading-tight tracking-tight text-foreground">
          {label}
        </h3>
        {subtitle && (
          <p className="font-body text-sm font-medium text-muted-foreground">
            {subtitle}
          </p>
        )}
        <span
          className="mt-1 font-mono text-xs font-bold uppercase tracking-wider"
          style={{ color: complexity.color }}
        >
          {complexity.text}
        </span>
      </div>
    </div>
  );
}
