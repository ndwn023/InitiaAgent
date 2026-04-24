"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

const EMOJIS = ["🚀", "💎", "💰", "📈", "🤖", "✨", "💸", "🔥"];

export function FallingEmojis() {
  const [emojis, setEmojis] = useState<
    Array<{
      id: number;
      emoji: string;
      x: number;
      delay: number;
      duration: number;
      size: number;
    }>
  >([]);

  useEffect(() => {
    // Generate random emojis on mount to avoid hydration mismatch
    const generated = Array.from({ length: 40 }).map((_, i) => ({
      id: i,
      emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
      x: Math.random() * 100, // random horizontal position (vw)
      delay: Math.random() * 5, // random delay before starting (max 5s)
      duration: 8 + Math.random() * 12, // random fall duration (8-20s)
      size: 1.5 + Math.random() * 2.5, // random size (rem)
    }));

    const timer = setTimeout(() => {
      setEmojis(generated);
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  if (emojis.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-50">
      {emojis.map((item) => (
        <motion.div
          key={item.id}
          initial={{ y: "-20vh", x: `${item.x}vw`, opacity: 0 }}
          animate={{
            y: ["-20vh", "120vh"],
            opacity: [0, 1, 1, 0],
            rotate: [0, 180, 360],
          }}
          transition={{
            duration: item.duration,
            delay: item.delay,
            repeat: Infinity,
            ease: "linear",
          }}
          className="absolute top-0"
          style={{ fontSize: `${item.size}rem` }}
        >
          {item.emoji}
        </motion.div>
      ))}
    </div>
  );
}
