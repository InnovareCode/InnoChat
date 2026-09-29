"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getQrCodeAction, type QrCodeView } from "@/modules/whatsapp/actions";

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 2 * 60 * 1000;

export type InstanceQrPhase = "loading" | "live" | "expired" | "blocked" | "error";

/**
 * QR ao vivo de UMA instância já existente (card "Aguardando QR" / "Reconectar"). Mesma cadência
 * do `ConnectWhatsappDialog` (3s, desiste em 2min), mas só roda enquanto `active` e a aba está
 * visível. Nunca guarda o QR além do estado local (expira rápido — ver `getQrCode`). `refresh()`
 * recomeça a janela de 2 minutos.
 */
export function useInstanceQr({
  tenantSlug,
  instanceId,
  active,
  onResult,
}: {
  tenantSlug: string;
  instanceId: string;
  active: boolean;
  onResult: (result: QrCodeView) => void;
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [phase, setPhase] = useState<InstanceQrPhase>("loading");
  const [runKey, setRunKey] = useState(0);
  const onResultRef = useRef(onResult);
  useEffect(() => {
    onResultRef.current = onResult;
  });

  const refresh = useCallback(() => {
    setPhase("loading");
    setRunKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let inFlight = false;
    const startedAt = Date.now();

    async function tick() {
      if (cancelled || inFlight) return;
      if (typeof document !== "undefined" && document.hidden) {
        timer = setTimeout(tick, POLL_INTERVAL_MS);
        return;
      }
      inFlight = true;
      let finished = false;
      try {
        const result = await getQrCodeAction(tenantSlug, instanceId);
        if (cancelled) return;
        if (!result.ok) {
          setPhase("error");
        } else if (result.data.blockedReason) {
          setPhase("blocked");
          setQrDataUrl(null);
          finished = true;
          onResultRef.current(result.data);
        } else if (result.data.status === "CONNECTED") {
          finished = true;
          onResultRef.current(result.data);
        } else {
          setQrDataUrl(result.data.qrCodeDataUrl);
          setPhase("live");
          onResultRef.current(result.data);
        }
      } finally {
        inFlight = false;
      }
      if (cancelled || finished) return;
      if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
        setPhase("expired");
        return;
      }
      timer = setTimeout(tick, POLL_INTERVAL_MS);
    }

    // `setTimeout(0)`: mesma razão de `react-hooks/set-state-in-effect` registrada no projeto.
    timer = setTimeout(tick, 0);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [active, tenantSlug, instanceId, runKey]);

  return { qrDataUrl, phase, refresh };
}
