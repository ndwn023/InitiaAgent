import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-[14px] border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-sm text-zinc-100 transition-all duration-[400ms] [transition-timing-function:cubic-bezier(0.36,0.2,0.07,1)] outline-none placeholder:text-zinc-600 hover:border-white/[0.12] hover:bg-white/[0.05] focus-within:scale-[0.98] focus:border-purple-500/40 focus:bg-white/[0.04] focus:ring-2 focus:ring-purple-500/10 disabled:pointer-events-none disabled:opacity-40 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }
