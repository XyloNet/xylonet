'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { ThemeProvider } from 'next-themes'
import { LazyMotion, MotionConfig, domAnimation } from 'motion/react'
import { walletConfig } from '@/config/wallet'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'

let queryClientInstance: QueryClient | null = null
function getQueryClient() {
  if (!queryClientInstance) {
    queryClientInstance = new QueryClient({
      defaultOptions: {
        queries: { staleTime: 60 * 1000, gcTime: 5 * 60 * 1000, refetchOnWindowFocus: false, retry: 1 },
      },
    })
  }
  return queryClientInstance
}

/**
 * Root providers. Wagmi (account state, reads, writes) is always present;
 * RainbowKit (the connect modal) lives in a lazily mounted island in the
 * header so the shell is interactive before any wallet UI code loads.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient()
  return (
    <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem disableTransitionOnChange>
      <LazyMotion features={domAnimation} strict>
        <MotionConfig reducedMotion="user" transition={{ duration: 0.22, ease: [0.25, 1, 0.5, 1] }}>
          <WagmiProvider config={walletConfig}>
            <QueryClientProvider client={queryClient}>
              <TooltipProvider delay={300}>
                {children}
              </TooltipProvider>
              <Toaster position="bottom-center" closeButton richColors={false} />
            </QueryClientProvider>
          </WagmiProvider>
        </MotionConfig>
      </LazyMotion>
    </ThemeProvider>
  )
}
