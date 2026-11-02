'use client'

import { useEffect } from 'react'
import { useTheme } from 'next-themes'

const THEME_COLOR = { dark: '#191e29', light: '#f5f7fa' } as const // token-exempt: meta tag colours, each equal to --background in its theme

/**
 * Keeps `<meta name="theme-color">` in step with the chosen theme. The theme is
 * picked in the app, not from the OS scheme, so the static meta alone would
 * leave navy browser chrome over the light theme.
 */
export function ThemeColorMeta() {
  const { resolvedTheme } = useTheme()
  useEffect(() => {
    const color = resolvedTheme === 'light' ? THEME_COLOR.light : THEME_COLOR.dark
    for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) meta.content = color
  }, [resolvedTheme])
  return null
}
