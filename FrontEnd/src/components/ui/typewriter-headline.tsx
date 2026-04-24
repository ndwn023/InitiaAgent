"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

const WORDS = [
  "Agent Platform",
  "Trading Bots",
  "Yield Optimizer",
  "Smart Automation",
];

export function TypewriterHeadline() {
  const text1 = "AI-Powered DeFi Trading ";

  const [displayedText1, setDisplayedText1] = useState("");
  const [displayedText2, setDisplayedText2] = useState("");
  const [phase, setPhase] = useState(0);
  const [wordIndex, setWordIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (phase === 0) {
      let i = 0;
      const interval = setInterval(() => {
        setDisplayedText1(text1.slice(0, i + 1));
        i++;
        if (i === text1.length) {
          clearInterval(interval);
          setTimeout(() => setPhase(1), 150);
        }
      }, 60);
      return () => clearInterval(interval);
    } else if (phase === 1) {
      const currentWord = WORDS[wordIndex];

      if (!isDeleting && displayedText2 === currentWord) {
        const timeout = setTimeout(() => setIsDeleting(true), 2000);
        return () => clearTimeout(timeout);
      }

      const timeout = setTimeout(
        () => {
          if (!isDeleting) {
            setDisplayedText2(currentWord.slice(0, displayedText2.length + 1));
          } else {
            setDisplayedText2(currentWord.slice(0, displayedText2.length - 1));
            if (displayedText2.length <= 1) {
              setIsDeleting(false);
              setWordIndex((prev) => (prev + 1) % WORDS.length);
            }
          }
        },
        isDeleting ? 30 : 80,
      );

      return () => clearTimeout(timeout);
    }
  }, [phase, displayedText2, isDeleting, wordIndex]);

  return (
    <h1 className="relative max-w-4xl text-4xl font-light tracking-tight sm:text-7xl min-h-[4em] sm:min-h-[2.5em] px-2 text-zinc-200">
      {/* Invisible placeholder */}
      <div className="invisible">
        AI-Powered DeFi Trading <br className="hidden sm:inline" />
        <span className="text-gradient font-bold">
          Smart Automation
        </span>
      </div>

      {/* Absolute positioned typing text */}
      <div className="absolute top-0 left-0 right-0 w-full h-full whitespace-pre-wrap">
        {displayedText1}
        {phase === 0 && (
          <motion.span
            animate={{ opacity: [1, 0] }}
            transition={{ repeat: Infinity, duration: 0.8 }}
            className="inline-block w-[2px] md:w-[3px] h-[0.85em] bg-zinc-400 ml-1 align-middle -translate-y-[0.05em]"
          />
        )}
        <br className="hidden sm:inline" />
        <span className="text-gradient font-bold">
          {displayedText2}
        </span>
        {phase >= 1 && (
          <motion.span
            animate={{ opacity: [1, 0] }}
            transition={{ repeat: Infinity, duration: 0.8 }}
            className="inline-block w-[2px] md:w-[3px] h-[0.85em] bg-emerald-400 ml-1 align-middle -translate-y-[0.05em]"
          />
        )}
      </div>
    </h1>
  );
}
