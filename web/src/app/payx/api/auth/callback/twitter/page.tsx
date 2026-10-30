"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get("code");
      const state = searchParams.get("state");
      const error = searchParams.get("error");

      if (error) {
        console.error("OAuth error:", error);
        router.push("/pay/creator?error=auth_failed");
        return;
      }

      if (!code || !state) {
        router.push("/pay/creator?error=missing_params");
        return;
      }

      try {
        const res = await fetch(`/api/payx/auth/callback/twitter`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ code, state }),
        });

        if (res.ok) {
          // A page that started the sign-in (e.g. /admin) can ask to be returned to; same-origin paths only.
          let back: string | null = null;
          try {
            back = window.sessionStorage.getItem("xylo:returnTo");
            window.sessionStorage.removeItem("xylo:returnTo");
          } catch {
            back = null;
          }
          router.push(back && /^\/[A-Za-z0-9/_-]*$/.test(back) ? back : "/pay/creator");
        } else {
          const data = (await res.json()) as { error?: string; reason?: string };
          console.error("Callback error:", data);
          const reason = data.reason ? `&reason=${encodeURIComponent(data.reason.slice(0, 200))}` : "";
          router.push(`/pay/creator?error=callback_failed${reason}`);
        }
      } catch (err) {
        console.error("Callback error:", err);
        router.push("/pay/creator?error=network_error");
      }
    };

    handleCallback();
  }, [searchParams, router]);

  return (
    <main className="flex min-h-[60dvh] items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-signal-deep animate-spin mx-auto mb-4" />
        <p className="text-ink-2">Completing sign in...</p>
      </div>
    </main>
  );
}

export default function TwitterCallbackPage() {
  return (
    <Suspense fallback={
      <main className="flex min-h-[60dvh] items-center justify-center bg-background">
        <Loader2 className="w-12 h-12 text-signal-deep animate-spin" />
      </main>
    }>
      <CallbackHandler />
    </Suspense>
  );
}
