"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

type GlowVariant = "cyan" | "purple" | "red" | "orange" | "green" | "none";

interface GlowCardProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  variant?: GlowVariant;
  elevated?: boolean;
  animated?: boolean;
  delay?: number;
}

const variantClasses: Record<GlowVariant, string> = {
  cyan:   "border-cyan-neon/20 shadow-[0_0_40px_rgba(0,245,255,0.08)] hover:shadow-[0_0_50px_rgba(0,245,255,0.15)] hover:border-cyan-neon/35",
  purple: "border-purple-neon/20 shadow-[0_0_40px_rgba(168,85,247,0.08)] hover:shadow-[0_0_50px_rgba(168,85,247,0.15)] hover:border-purple-neon/35",
  red:    "border-red-500/20 shadow-[0_0_40px_rgba(255,71,87,0.08)] hover:shadow-[0_0_50px_rgba(255,71,87,0.15)] hover:border-red-500/35",
  orange: "border-orange-500/20 shadow-[0_0_40px_rgba(249,115,22,0.08)] hover:shadow-[0_0_50px_rgba(249,115,22,0.15)] hover:border-orange-500/35",
  green:  "border-green-500/20 shadow-[0_0_40px_rgba(34,197,94,0.08)] hover:shadow-[0_0_50px_rgba(34,197,94,0.15)] hover:border-green-500/35",
  none:   "border-white/6",
};

export function GlowCard({
  children,
  variant = "cyan",
  elevated = false,
  animated = true,
  delay = 0,
  className,
  ...rest
}: GlowCardProps) {
  const baseClass = cn(
    "relative rounded-2xl border transition-all duration-500 overflow-hidden",
    elevated ? "bg-[rgba(17,17,42,0.85)]" : "bg-[rgba(12,12,30,0.80)]",
    "backdrop-blur-xl",
    variantClasses[variant],
    "card-hover",
    className
  );

  if (!animated) {
    return (
      <div className={baseClass} {...(rest as React.HTMLAttributes<HTMLDivElement>)}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={baseClass}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
