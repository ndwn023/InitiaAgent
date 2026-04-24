import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-full border border-transparent px-3 text-[11px] font-medium whitespace-nowrap transition-all duration-300 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-emerald-500/12 text-emerald-400 border-emerald-500/15",
        secondary:
          "bg-white/[0.05] text-zinc-400 border-white/[0.06]",
        destructive:
          "bg-red-500/10 text-red-400 border-red-500/15",
        outline:
          "border-white/[0.08] text-zinc-500",
        ghost:
          "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]",
        link: "text-emerald-400 underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
