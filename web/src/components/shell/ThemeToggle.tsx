'use client'

import { useSyncExternalStore } from 'react'
import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const noSubscribe = () => () => {}

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(noSubscribe, () => true, () => false)
  const dark = mounted && resolvedTheme === 'dark'
  const label = dark ? 'Switch to light theme' : 'Switch to dark theme'
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-lg"
            className={className}
            aria-label={label}
            onClick={() => setTheme(dark ? 'light' : 'dark')}
          />
        }
      >
        {mounted ? dark ? <Sun /> : <Moon /> : <span className="size-4" aria-hidden />}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
