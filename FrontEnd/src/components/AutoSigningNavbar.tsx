'use client'

import { useInterwovenKit } from '@initia/interwovenkit-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ShieldCheck, Zap, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export function AutoSigningNavbar() {
  const { autoSign, isConnected, openConnect } = useInterwovenKit()
  const [isToggling, setIsToggling] = useState(false)

  const numericChainId = "2124225178762456"
  const stringChainId = "evm-1"

  const isEnabled = autoSign?.isEnabledByChain?.[stringChainId] || autoSign?.isEnabledByChain?.[numericChainId] || false

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!isConnected) {
      openConnect()
      return
    }

    setIsToggling(true)
    try {
      if (isEnabled) {
        await autoSign?.disable(stringChainId)
        try { await autoSign?.disable(numericChainId) } catch {}
      } else {
        await autoSign?.enable(stringChainId)
      }
    } catch (error: any) {
      if (error?.message?.includes('rejected') || error?.message?.includes('User denied')) {
        console.log("User rejected session request")
      } else if (!error?.message?.includes('authorization not found')) {
        console.error("Failed to toggle auto-sign:", error)
      }
    } finally {
      setIsToggling(false)
    }
  }

  if (!isConnected) return null

  return (
    <motion.div
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease: [0.36, 0.2, 0.07, 1] }}
      className="flex items-center"
    >
      <Button
        onClick={handleToggle}
        disabled={isToggling}
        variant="ghost"
        size="sm"
        className={`h-8 px-3 rounded-full border gap-2 ${
          isEnabled
            ? 'bg-emerald-500/[0.08] border-emerald-500/15 text-emerald-400 hover:bg-emerald-500/[0.12]'
            : 'bg-white/[0.03] border-white/[0.06] text-zinc-500 hover:text-zinc-300 hover:border-white/[0.08]'
        }`}
      >
        <AnimatePresence mode="wait">
          {isToggling ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
            >
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            </motion.div>
          ) : (
            <motion.div
              key={isEnabled ? "active" : "inactive"}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex items-center gap-1.5"
            >
              {isEnabled ? (
                <>
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-medium uppercase tracking-wider hidden lg:inline">Ghost Mode</span>
                </>
              ) : (
                <>
                  <Zap className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-medium uppercase tracking-wider hidden lg:inline">Session UX</span>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </Button>
    </motion.div>
  )
}
