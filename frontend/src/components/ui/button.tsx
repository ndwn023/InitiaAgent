import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-[14px] border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap outline-none select-none transition-all duration-200 [transition-timing-function:cubic-bezier(0.36,0.2,0.07,1)] focus-visible:ring-2 focus-visible:ring-purple-500/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[#010101] active:scale-[0.96] disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-r from-[#FA93FA] via-[#C967E8] to-[#983AD6] text-white hover:opacity-90 shadow-[0_0_30px_-8px_rgba(201,103,232,0.4)] hover:shadow-[0_0_40px_-5px_rgba(201,103,232,0.5)] hover:-translate-y-[1px]",
        outline:
          "border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.07] text-zinc-300 hover:text-zinc-100 hover:border-white/[0.12]",
        secondary:
          "bg-white/[0.06] text-zinc-300 hover:bg-white/[0.10] hover:text-zinc-100",
        ghost:
          "hover:bg-white/[0.05] text-zinc-400 hover:text-zinc-200",
        destructive:
          "bg-red-500/10 text-red-400 hover:bg-red-500/20 border-red-500/10",
        link: "text-purple-400 underline-offset-4 hover:underline hover:text-purple-300",
        glass: "bg-white/[0.04] backdrop-blur-sm border-white/[0.08] text-zinc-200 hover:bg-white/[0.08] hover:border-white/[0.14]",
      },
      size: {
        default: "h-9 gap-2 px-4",
        xs: "h-6 gap-1 rounded-[10px] px-2.5 text-xs",
        sm: "h-8 gap-1.5 rounded-[12px] px-3 text-[13px]",
        lg: "h-11 gap-2 px-5 text-[15px] rounded-[16px]",
        icon: "size-9",
        "icon-xs": "size-6 rounded-[10px]",
        "icon-sm": "size-8 rounded-[12px]",
        "icon-lg": "size-11 rounded-[16px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
