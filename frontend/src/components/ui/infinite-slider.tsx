"use client";

import { motion } from "framer-motion";

interface InfiniteSliderProps {
  items: { name: string; logo?: string }[];
  speed?: number;
  className?: string;
}

export function InfiniteSlider({ items, speed = 30, className }: InfiniteSliderProps) {
  const doubled = [...items, ...items];

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div className="flex">
        <motion.div
          className="flex gap-10 shrink-0"
          animate={{ x: [0, `-50%`] }}
          transition={{
            duration: speed,
            repeat: Infinity,
            ease: "linear",
            repeatType: "loop",
          }}
          style={{ width: "max-content" }}
        >
          {doubled.map((item, i) => (
            <div
              key={i}
              className="flex items-center gap-2.5 text-zinc-500 text-[13px] font-medium whitespace-nowrap hover:text-zinc-300 transition-colors duration-200"
            >
              {item.logo ? (
                // Intentional <img>: keeps this unused slider component out of
                // Next.js's shared `next/image` chunk so dev Turbopack HMR
                // never racks up stale module factories in layout shells.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.logo}
                  alt={item.name}
                  className="h-5 w-auto opacity-40 hover:opacity-70 transition-opacity brightness-0 invert"
                />
              ) : (
                <>
                  <span className="h-1 w-1 rounded-full bg-purple-500/40 shrink-0" />
                  {item.name}
                </>
              )}
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
