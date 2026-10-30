'use client'

import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { currentSubscription, pushSupported, subscribeToPayments, unsubscribeFromPayments } from '@/lib/push/client'

/** "Tell me when I get paid" for the signed-in creator. */
export function NotifyToggle({ handle }: { handle: string }) {
  const [supported, setSupported] = useState(false)
  const [on, setOn] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setSupported(pushSupported())
    currentSubscription().then((s) => setOn(!!s)).catch(() => {})
  }, [])

  if (!supported) return null

  const toggle = async (next: boolean) => {
    setBusy(true)
    try {
      if (next) {
        const r = await subscribeToPayments()
        if (r === 'granted') {
          setOn(true)
          toast.success('You will hear the moment @' + handle + ' gets paid')
        } else if (r === 'denied') toast.error('Notifications are blocked for this site in your browser settings')
        else toast.error('Could not turn notifications on')
      } else {
        await unsubscribeFromPayments()
        setOn(false)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2.5">
      <Label htmlFor="notify-toggle" className="inline-flex items-center gap-2 text-[13.5px]">
        <Bell className="size-4 text-ink-3" />
        Notify me when a payment lands
      </Label>
      <Switch id="notify-toggle" checked={on} disabled={busy} onCheckedChange={(v) => void toggle(!!v)} />
    </div>
  )
}
