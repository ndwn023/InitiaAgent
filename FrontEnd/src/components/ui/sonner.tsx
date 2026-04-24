"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme={"dark"}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-[#111113]/95 group-[.toaster]:backdrop-blur-xl group-[.toaster]:text-zinc-200 group-[.toaster]:border-white/[0.06] group-[.toaster]:shadow-[0_2px_4px_rgba(0,0,0,0.06),0_24px_48px_-12px_rgba(0,0,0,0.2)] group-[.toaster]:rounded-[20px] font-sans",
          description: "group-[.toast]:text-zinc-500 text-xs",
          actionButton:
            "group-[.toast]:bg-emerald-500 group-[.toast]:text-zinc-950 group-[.toast]:rounded-[12px] font-medium",
          cancelButton:
            "group-[.toast]:bg-white/[0.05] group-[.toast]:text-zinc-400 group-[.toast]:rounded-[12px] font-medium",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
