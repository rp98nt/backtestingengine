"use client";

import { useEffect, useState } from "react";
import { CloseSparkline } from "@/components/CloseSparkline";
import { fetchInstrumentOhlcv } from "@/lib/api";

export function SymbolSparkline({ symbol }: { symbol: string }) {
  const [closes, setCloses] = useState<number[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setCloses(null);
    void (async () => {
      try {
        const res = await fetchInstrumentOhlcv(symbol, 200);
        if (cancelled) return;
        setCloses(res.data.map((r) => r.close));
      } catch {
        if (!cancelled) setCloses([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  if (closes === null) {
    return <span className="inline-block w-[120px] text-center text-[10px] text-slate-600">…</span>;
  }
  if (closes.length < 2) {
    return <span className="text-[10px] text-slate-600">no series</span>;
  }
  return <CloseSparkline closes={closes} width={120} height={36} />;
}
