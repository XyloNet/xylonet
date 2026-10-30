'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/payx/useAuth'

function XMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

/** What a visitor sees on /admin: a sign-in, or a refusal. Says nothing about what is behind it. */
export function AdminGate({ signedIn, handle }: { signedIn: boolean; handle: string | null }) {
  const { signIn, signOut, busy } = useAuth()
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="mx-auto max-w-[480px] px-4 pb-16 pt-16 sm:px-5">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
        {!signedIn ? (
          <>
            <h1 className="text-[20px] font-semibold">XyloNet team</h1>
            <p className="mt-2 text-[14px] text-ink-2">Sign in with X to continue.</p>
            <Button
              size="lg"
              className="mt-4 h-10 w-full font-semibold"
              disabled={busy}
              onClick={() => {
                setError(null)
                try {
                  window.sessionStorage.setItem('xylo:returnTo', '/admin')
                } catch {
                  /* private mode: the user lands on /pay/creator and opens /admin again */
                }
                signIn().catch((e: Error) => setError(e.message))
              }}
            >
              <XMark className="size-4" />
              {busy ? 'Opening X…' : 'Sign in with X'}
            </Button>
            {error && <p className="mt-3 text-[13px] text-bad" role="alert">{error}</p>}
          </>
        ) : (
          <>
            <h1 className="text-[20px] font-semibold">This page is for the XyloNet team.</h1>
            <p className="mt-2 text-[14px] text-ink-2">You are signed in as @{handle}. Nothing here is available to this account.</p>
            <Button variant="outline" size="lg" className="mt-4 h-9" disabled={busy} onClick={() => signOut().then(() => window.location.reload())}>
              Sign out
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
