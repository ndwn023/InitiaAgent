"use client";

import { useEffect, useState } from "react";

export function AnimatedBackground() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Defer heavy background rendering to after initial paint
    const timer = requestAnimationFrame(() => {
      requestAnimationFrame(() => setMounted(true));
    });
    return () => cancelAnimationFrame(timer);
  }, []);

  if (!mounted) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* Video background */}
      <video
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        className="absolute inset-0 w-full h-full object-cover opacity-[0.38]"
        style={{ filter: "saturate(0.85) hue-rotate(230deg) brightness(0.7)" }}
      >
        <source
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260210_031346_d87182fb-b0af-4273-84d1-c6fd17d6bf0f.mp4"
          type="video/mp4"
        />
      </video>

      {/* Dark base overlay */}
      <div className="absolute inset-0" style={{ background: "rgba(3,1,10,0.60)" }} />

      {/* Subtle noise texture — using CSS only, no SVG filter */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "256px 256px",
        }}
      />

      {/* Purple orb - top left — CSS animation instead of JS (GPU-only) */}
      <div
        className="absolute top-[-10%] left-[-5%] w-[55vw] h-[55vw] rounded-full blur-[160px] will-change-transform"
        style={{
          background: "rgba(201,103,232,0.07)",
          animation: "float-orb1 28s linear infinite",
        }}
      />

      {/* Pink orb - top right */}
      <div
        className="absolute top-[-5%] right-[-5%] w-[45vw] h-[45vw] rounded-full blur-[140px] will-change-transform"
        style={{
          background: "rgba(250,147,250,0.05)",
          animation: "float-orb2 35s linear infinite",
        }}
      />

      {/* Deep purple orb - bottom */}
      <div
        className="absolute bottom-[5%] left-[30%] w-[40vw] h-[40vw] rounded-full blur-[150px] will-change-transform"
        style={{
          background: "rgba(123,57,252,0.05)",
          animation: "float-orb3 40s linear infinite",
        }}
      />
    </div>
  );
}
