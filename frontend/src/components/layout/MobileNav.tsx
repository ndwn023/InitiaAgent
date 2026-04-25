"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Store, Wrench, Trophy } from "lucide-react";
import { motion } from "framer-motion";

export function MobileNav() {
  const pathname = usePathname();

  const links = [
    { name: "Market", href: "/app/marketplace", icon: Store },
    { name: "Dash", href: "/app/dashboard", icon: LayoutDashboard },
    { name: "Build", href: "/app/builder", icon: Wrench },
    { name: "Board", href: "/app/leaderboard", icon: Trophy },
  ];

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:hidden">
      <div
        className="flex h-16 items-center justify-around rounded-[22px] border border-white/[0.07] px-2 shadow-[0_4px_60px_-15px_rgba(201,103,232,0.2),0_2px_4px_rgba(0,0,0,0.3)]"
        style={{
          background: "rgba(10,6,24,0.85)",
          backdropFilter: "blur(40px)",
          WebkitBackdropFilter: "blur(40px)",
        }}
      >
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href;

          return (
            <Link
              key={link.name}
              href={link.href}
              className={cn(
                "flex flex-col items-center gap-1 transition-all duration-300 relative py-2 px-5 rounded-[16px]",
                isActive ? "text-white" : "text-zinc-600 hover:text-zinc-400"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="activeMobileTab"
                  className="absolute inset-0 rounded-[16px] -z-10 border border-purple-500/20"
                  style={{ background: "rgba(201,103,232,0.1)" }}
                  initial={false}
                  transition={{ type: "spring", stiffness: 400, damping: 35 }}
                />
              )}
              <Icon
                className={cn(
                  "h-[18px] w-[18px] transition-colors duration-200",
                  isActive ? "text-purple-400" : "text-zinc-600"
                )}
              />
              <span className={cn("text-[10px] font-semibold", isActive ? "text-purple-400" : "")}>
                {link.name}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
