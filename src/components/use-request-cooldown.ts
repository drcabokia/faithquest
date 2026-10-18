"use client";
import { useCallback, useEffect, useState } from "react";
import { AccountRequestError } from "@/lib/account-client";

export function useRequestCooldown() {
  const [until, setUntil] = useState(0),
    [seconds, setSeconds] = useState(0);
  const pause = useCallback((error: unknown) => {
    if (error instanceof AccountRequestError && error.retryAfterSeconds > 0) {
      setUntil(Date.now() + error.retryAfterSeconds * 1000);
      setSeconds(error.retryAfterSeconds);
    }
  }, []);
  useEffect(() => {
    if (!until) return;
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      setSeconds(remaining);
      if (!remaining) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [until]);
  return { seconds, pause };
}
