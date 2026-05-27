"use client";

import { useEffect, useState } from "react";

export function MswProvider({ children }: { children: React.ReactNode }) {
  const enabled =
    process.env.NEXT_PUBLIC_API_MOCKING === "enabled" &&
    process.env.NODE_ENV !== "production";

  const [ready, setReady] = useState(!enabled);

  useEffect(() => {
    if (!enabled) return;

    let active = true;

    import("@/mocks/browser").then(({ worker }) =>
      worker
        .start({ onUnhandledRequest: "bypass" })
        .then(() => {
          if (active) setReady(true);
        })
    );

    return () => {
      active = false;
    };
  }, [enabled]);

  return ready ? <>{children}</> : null;
}
