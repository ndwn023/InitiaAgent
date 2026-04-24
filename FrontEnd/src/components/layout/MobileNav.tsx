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
      <div className="flex h-14 items-center justify-around rounded-[20px] border border-white/[0.06] bg-[#08080a]/90 backdrop-blur-xl px-2 shadow-[0_2px_4px_rgba(0,0,0,0.08),0_24px_48px_-12px_rgba(0,0,0,0.3)]">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href;

          return (
            <Link
              key={link.name}
              href={link.href}
              className={cn(
                "flex flex-col items-center gap-0.5 transition-all duration-[400ms] [transition-timing-function:cubic-bezier(0.36,0.2,0.07,1)] relative py-1.5 px-4 rounded-[14px]",
                isActive ? "text-emerald-400" : "text-zinc-600 hover:text-zinc-400"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="activeMobileTab"
                  className="absolute inset-0 bg-emerald-500/[0.08] rounded-[14px] -z-10"
                  initial={false}
                  transition={{ type: "spring", stiffness: 350, damping: 35 }}
                />
              )}
              <Icon className={cn("h-[18px] w-[18px]", isActive && "text-emerald-400")} />
              <span className="text-[10px] font-medium">{link.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
