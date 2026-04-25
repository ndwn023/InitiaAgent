import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { PageTransition } from "@/components/layout/PageTransition";
import { AnimatedBackground } from "@/components/ui/animated-background";
import { ErrorBoundary } from "@/components/providers/ErrorBoundary";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex h-screen w-full text-zinc-50 overflow-hidden relative flex-col md:flex-row"
      style={{ background: "#010101" }}
    >
      <AnimatedBackground />
      <MobileHeader />
      <Sidebar />
      <main className="flex-1 overflow-auto relative z-10 pb-28 md:pb-0">
        {/* Ambient purple glows — static divs, no animation */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10">
          <div
            className="absolute -top-[20%] -left-[10%] w-[40%] h-[40%] rounded-full blur-[140px]"
            style={{ background: "rgba(201,103,232,0.04)" }}
          />
          <div
            className="absolute top-[40%] -right-[10%] w-[30%] h-[30%] rounded-full blur-[120px]"
            style={{ background: "rgba(250,147,250,0.03)" }}
          />
        </div>
        <ErrorBoundary>
          <PageTransition>{children}</PageTransition>
        </ErrorBoundary>
      </main>
      <MobileNav />
    </div>
  );
}
