"use client";

import { useState, useCallback } from "react";
import InputForm from "@/components/InputForm";
import TotalForm from "@/components/TotalForm";
import Summary from "@/components/Summary";
import Charts from "@/components/Charts";
import ResultTable from "@/components/ResultTable";
import type { Params, SolveResult } from "@/types";
import { DEFAULT_PARAMS } from "@/types";

type State = "idle" | "loading" | "result" | "error";

function encodeParams(
  additional: number,
  purchased: number,
  points: number,
  params: Params
): string {
  const obj = {
    add: additional,
    cp: purchased,
    sp: points,
    up: params.unitPriceTaxIn,
    tr: Math.round(params.taxRate * 100),
    pr: Math.round(params.pointRate * 100),
    me: params.minEligibleTotal,
    ob: params.objective,
  };
  return new URLSearchParams(
    Object.entries(obj).map(([k, v]) => [k, String(v)])
  ).toString();
}

function decodeParams(search: string): {
  additional: number;
  purchased: number;
  points: number;
  params: Params;
} | null {
  try {
    const p = new URLSearchParams(search);
    const add = parseInt(p.get("add") ?? p.get("n") ?? "", 10);
    const cp = parseInt(p.get("cp") ?? "0", 10);
    const sp = parseInt(p.get("sp") ?? "0", 10);
    if (!add || add < 1) return null;
    return {
      additional: add,
      purchased: Number.isFinite(cp) ? cp : 0,
      points: Number.isFinite(sp) ? sp : 0,
      params: {
        unitPriceTaxIn: parseInt(p.get("up") ?? "1800", 10),
        taxRate: parseInt(p.get("tr") ?? "10", 10) / 100,
        pointRate: parseInt(p.get("pr") ?? "20", 10) / 100,
        minEligibleTotal: parseInt(p.get("me") ?? "10000", 10),
        eligibleBasis: "order_total",
        taxExMethod: "taxex_floor_then_rate",
        objective: (p.get("ob") as Params["objective"]) ?? "min_cash_then_min_orders",
      },
    };
  } catch {
    return null;
  }
}

export default function Home() {
  const [tab, setTab] = useState<"total" | "additional">("total");
  const [state, setState] = useState<State>("idle");
  const [result, setResult] = useState<SolveResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [initialAdditional] = useState(() => {
    if (typeof window === "undefined") return 1;
    const decoded = decodeParams(window.location.search);
    return decoded?.additional ?? 1;
  });
  const [initialPurchased] = useState(() => {
    if (typeof window === "undefined") return 0;
    const decoded = decodeParams(window.location.search);
    return decoded?.purchased ?? 0;
  });
  const [initialPoints] = useState(() => {
    if (typeof window === "undefined") return 0;
    const decoded = decodeParams(window.location.search);
    return decoded?.points ?? 0;
  });
  const [initialParams] = useState<Params>(() => {
    if (typeof window === "undefined") return DEFAULT_PARAMS;
    const decoded = decodeParams(window.location.search);
    return decoded?.params ?? DEFAULT_PARAMS;
  });
  const [copied, setCopied] = useState(false);

  const handleAdditionalSubmit = useCallback(
    async (additional: number, params: Params, startPoints: number, purchased: number) => {
      setState("loading");
      setResult(null);
      setShareUrl("");
      try {
        const res = await fetch("/api/solve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ n: additional, params, startPoints }),
        });
        const data = await res.json();
        if (!res.ok) {
          setErrorMsg(data.error ?? "エラーが発生しました");
          setState("error");
          return;
        }
        setResult(data as SolveResult);
        setState("result");
        const url = `${window.location.origin}${window.location.pathname}?${encodeParams(additional, purchased, startPoints, params)}`;
        setShareUrl(url);
        window.history.replaceState(null, "", `?${encodeParams(additional, purchased, startPoints, params)}`);
      } catch {
        setErrorMsg("通信エラーが発生しました");
        setState("error");
      }
    },
    []
  );

  const handleTotalSubmit = useCallback(async (total: number, params: Params) => {
    setState("loading");
    setResult(null);
    setShareUrl("");
    try {
      const res = await fetch("/api/solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ n: total, params, startPoints: 0 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? "エラーが発生しました");
        setState("error");
        return;
      }
      setResult(data as SolveResult);
      setState("result");
      const url = `${window.location.origin}${window.location.pathname}?${encodeParams(total, 0, 0, params)}`;
      setShareUrl(url);
      window.history.replaceState(null, "", `?${encodeParams(total, 0, 0, params)}`);
    } catch {
      setErrorMsg("通信エラーが発生しました");
      setState("error");
    }
  }, []);

  async function handleCopy() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center">
          <h1 className="text-base font-bold text-gray-900 tracking-tight">
            ポイント分割購入プランナー
          </h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Form card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-gray-100 bg-gray-50/60">
            {(["total", "additional"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                  tab === t
                    ? "border-blue-600 text-blue-600 bg-white"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                {t === "total" ? "合計枚数から計算" : "追加購入"}
              </button>
            ))}
          </div>

          <div className="p-5 sm:p-6">
            {tab === "additional" ? (
              <InputForm
                onSubmit={handleAdditionalSubmit}
                loading={state === "loading"}
                initialAdditional={initialAdditional}
                initialPurchased={initialPurchased}
                initialPoints={initialPoints}
                initialParams={initialParams}
              />
            ) : (
              <TotalForm
                onSubmit={handleTotalSubmit}
                loading={state === "loading"}
                initialTotal={initialAdditional}
                initialParams={initialParams}
              />
            )}
          </div>
        </div>

        {/* Loading */}
        {state === "loading" && (
          <div className="flex flex-col items-center gap-3 py-14">
            <div className="w-8 h-8 border-[3px] border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-400">最適なプランを計算しています…</p>
          </div>
        )}

        {/* Error */}
        {state === "error" && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
            <span className="text-red-500 mt-0.5 shrink-0">✕</span>
            <div>
              <p className="text-sm font-medium text-red-800">エラーが発生しました</p>
              <p className="text-xs text-red-600 mt-0.5">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* Result */}
        {state === "result" && result && (
          <div className="space-y-4">
            <Summary result={result} />

            <Charts result={result} />

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-800">注文内訳</h2>
                <span className="text-xs text-gray-400 tabular-nums">
                  {result.meta.timeMs} ms{!result.meta.exact && " · 近似解"}
                </span>
              </div>
              <ResultTable orders={result.orders} />
            </div>

            <div className="space-y-1 px-1">
              <p className="text-xs text-gray-400">・この結果は、丸めと判定基準の設定に依存します。</p>
              <p className="text-xs text-gray-400">・ポイントは同一注文内では増えず、次回以降に使える前提です。</p>
            </div>

            {shareUrl && (
              <div className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3">
                <span className="text-xs text-gray-400 flex-1 truncate font-mono">{shareUrl}</span>
                <button
                  onClick={handleCopy}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors shrink-0 ${
                    copied
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 hover:bg-gray-200 text-gray-600"
                  }`}
                >
                  {copied ? "コピーしました" : "URLをコピー"}
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
