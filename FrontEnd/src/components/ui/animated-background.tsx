"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export function AnimatedBackground() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  if (!mounted) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#08080a]">
      {/* Morpho-style subtle noise texture */}
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "256px 256px",
        }}
      />

      {/* Subtle gradient orbs - restrained, not flashy */}
      <motion.div
        animate={{
          x: ["0vw", "12vw", "-8vw", "0vw"],
          y: ["0vh", "8vh", "-12vh", "0vh"],
          scale: [1, 1.1, 0.95, 1],
        }}
        transition={{
          duration: 30,
          repeat: Infinity,
          ease: "linear",
        }}
        className="absolute top-[15%] left-[20%] w-[35vw] h-[35vw] rounded-full bg-emerald-500/[0.04] blur-[120px]"
      />

      <motion.div
        animate={{
          x: ["0vw", "-12vw", "8vw", "0vw"],
          y: ["0vh", "-8vh", "12vh", "0vh"],
          scale: [1, 0.95, 1.1, 1],
        }}
        transition={{
          duration: 35,
          repeat: Infinity,
          ease: "linear",
        }}
        className="absolute bottom-[10%] right-[15%] w-[30vw] h-[30vw] rounded-full bg-teal-500/[0.03] blur-[140px]"
      />

      <motion.div
        animate={{
          x: ["0vw", "10vw", "-10vw", "0vw"],
          y: ["0vh", "10vh", "-10vh", "0vh"],
        }}
        transition={{
          duration: 40,
          repeat: Infinity,
          ease: "linear",
        }}
        className="absolute top-[45%] left-[55%] w-[25vw] h-[25vw] rounded-full bg-cyan-500/[0.02] blur-[100px]"
      />
    </div>
  );
}
