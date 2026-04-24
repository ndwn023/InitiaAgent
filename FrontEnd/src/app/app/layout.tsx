import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { PageTransition } from "@/components/layout/PageTransition";
import { AnimatedBackground } from "@/components/ui/animated-background";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-full bg-[#08080a] text-zinc-50 overflow-hidden relative flex-col md:flex-row">
      <AnimatedBackground />
      <MobileHeader />
      <Sidebar />
      <main className="flex-1 overflow-auto relative z-10 pb-28 md:pb-0">
        {/* Subtle ambient glows - Morpho-restrained */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10">
          <div className="absolute -top-[15%] -left-[10%] w-[35%] h-[35%] rounded-full bg-emerald-500/[0.03] blur-[120px]" />
          <div className="absolute top-[30%] -right-[10%] w-[25%] h-[25%] rounded-full bg-teal-500/[0.02] blur-[100px]" />
        </div>
        <PageTransition>{children}</PageTransition>
      </main>
      <MobileNav />
    </div>
  );
}
