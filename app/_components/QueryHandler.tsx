"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

export default function QueryHandler({
  onOpenLogin,
}: {
  onOpenLogin: () => void;
}) {
  const sp = useSearchParams();

  useEffect(() => {
    // exemplo: ?login=1 ou ?openLogin=1
    const openLogin = sp.get("login") === "1" || sp.get("openLogin") === "1";
    if (openLogin) onOpenLogin();
  }, [sp, onOpenLogin]);

  return null;
}
