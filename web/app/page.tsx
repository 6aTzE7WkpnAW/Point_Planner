"use client";

import { useCallback, useState } from "react";
import BudgetForm from "@/components/BudgetForm";
import InputForm from "@/components/InputForm";
import ResultTable from "@/components/ResultTable";
import Summary from "@/components/Summary";
import TotalForm from "@/components/TotalForm";
import { DEFAULT_PARAMS } from "@/types";
import type { Coupon, Params, SolveResult, SolveReverseResult } from "@/types";

type State = "idle" | "loading" | "result" | "error";

function serializeCoupons(coupons?: Coupon[]): string {
  return (coupons ?? [])
    .map((coupon) => `${coupon.minTotal}-${coupon.discount}-${coupon.count}`)
    .join(";");
}

function deserializeCoupons(value: string | null): Coupon[] {
  if (!value) {
    return [];
  }
  return value
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [minTotal, discount, count] = item.split("-");
      return {
        minTotal: parseInt(minTotal, 10),
        discount: parseInt(discount, 10),
        count: parseInt(count ?? "1", 10),
      };
    })
    .filter((coupon) =>
      Number.isInteger(coupon.minTotal) &&
      coupon.minTotal >= 0 &&
      Number.isInteger(coupon.discount) &&
      coupon.discount >= 0 &&
      Number.isInteger(coupon.count) &&
      coupon.count > 0
    );
}

function encodeParams(additional: number, purchased: number, points: number, params: Params): string {
  const obj = {
    add: additional,
    cp: purchased,
    sp: points,
    up: params.unitPriceTaxIn,
    tr: Math.round(params.taxRate * 100),
    pr: Math.round(params.pointRate * 100),
    me: params.minEligibleTotal,
    ob: params.objective,
    cu: serializeCoupons(params.coupons),
  };
  return new URLSearchParams(Object.entries(obj).map(([key, value]) => [key, String(value)])).toString();
}

function decodeParams(search: string): {
  additional: number;
  purchased: number;
  points: number;
  params: Params;
} | null {
  try {
    const query = new URLSearchParams(search);
    const additional = parseInt(query.get("add") ?? query.get("n") ?? "", 10);
    const purchased = parseInt(query.get("cp") ?? "0", 10);
    const points = parseInt(query.get("sp") ?? "0", 10);

    if (!additional || additional < 1) {
      return null;
    }

    return {
      additional,
      purchased: Number.isFinite(purchased) ? purchased : 0,
      points: Number.isFinite(points) ? points : 0,
      params: {
        unitPriceTaxIn: parseInt(query.get("up") ?? "1800", 10),
        taxRate: parseInt(query.get("tr") ?? "10", 10) / 100,
        pointRate: parseInt(query.get("pr") ?? "20", 10) / 100,
        minEligibleTotal: parseInt(query.get("me") ?? "10000", 10),
        eligibleBasis: "order_total",
        taxExMethod: "taxex_floor_then_rate",
        objective: (query.get("ob") as Params["objective"]) ?? "min_cash_then_min_orders",
        coupons: deserializeCoupons(query.get("cu")),
      },
    };
  } catch {
    return null;
  }
}

export default function Home() {
  const [tab, setTab] = useState<"total" | "additional" | "budget">("total");
  const [state, setState] = useState<State>("idle");
  const [result, setResult] = useState<SolveResult | null>(null);
  const [resultN, setResultN] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const [initialAdditional] = useState(() => {
    if (typeof window === "undefined") return 1;
    return decodeParams(window.location.search)?.additional ?? 1;
  });
  const [initialPurchased] = useState(() => {
    if (typeof window === "undefined") return 0;
    return decodeParams(window.location.search)?.purchased ?? 0;
  });
  const [initialPoints] = useState(() => {
    if (typeof window === "undefined") return 0;
    return decodeParams(window.location.search)?.points ?? 0;
  });
  const [initialParams] = useState<Params>(() => {
    if (typeof window === "undefined") return DEFAULT_PARAMS;
    return decodeParams(window.location.search)?.params ?? DEFAULT_PARAMS;
  });

  const handleAdditionalSubmit = useCallback(
    async (additional: number, params: Params, startPoints: number, purchased: number) => {
      setState("loading");
      setResult(null);
      setResultN(null);
      setShareUrl("");

      try {
        const response = await fetch("/api/solve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ n: additional, params, startPoints }),
        });
        const data = await response.json();
        if (!response.ok) {
          setErrorMsg(data.error ?? "エラーが発生しました。");
          setState("error");
          return;
        }

        setResult(data as SolveResult);
        setState("result");

        const encoded = encodeParams(additional, purchased, startPoints, params);
        const url = `${window.location.origin}${window.location.pathname}?${encoded}`;
        setShareUrl(url);
        window.history.replaceState(null, "", `?${encoded}`);
      } catch {
        setErrorMsg("通信エラーが発生しました。");
        setState("error");
      }
    },
    []
  );

  const handleTotalSubmit = useCallback(async (total: number, params: Params) => {
    setState("loading");
    setResult(null);
    setResultN(null);
    setShareUrl("");

    try {
      const response = await fetch("/api/solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ n: total, params, startPoints: 0 }),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrorMsg(data.error ?? "エラーが発生しました。");
        setState("error");
        return;
      }

      setResult(data as SolveResult);
      setState("result");

      const encoded = encodeParams(total, 0, 0, params);
      const url = `${window.location.origin}${window.location.pathname}?${encoded}`;
      setShareUrl(url);
      window.history.replaceState(null, "", `?${encoded}`);
    } catch {
      setErrorMsg("通信エラーが発生しました。");
      setState("error");
    }
  }, []);

  const handleBudgetSubmit = useCallback(async (budget: number, startPoints: number, params: Params) => {
    setState("loading");
    setResult(null);
    setResultN(null);
    setShareUrl("");

    try {
      const response = await fetch("/api/solve-reverse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ budget, params, startPoints }),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrorMsg(data.error ?? "エラーが発生しました。");
        setState("error");
        return;
      }

      const reverseResult = data as SolveReverseResult;
      setResult(reverseResult);
      setResultN(reverseResult.n);
      setState("result");
    } catch {
      setErrorMsg("通信エラーが発生しました。");
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
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-14 max-w-4xl items-center px-4 sm:px-6">
          <h1 className="text-base font-bold tracking-tight text-gray-900">ポイント分割購入プランナー</h1>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-5 px-4 py-6 sm:px-6">
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="flex border-b border-gray-100 bg-gray-50/60">
            {(["total", "additional", "budget"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                className={`border-b-2 px-5 py-3 text-sm font-medium transition-colors ${
                  tab === value
                    ? "border-blue-600 bg-white text-blue-600"
                    : "border-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                }`}
              >
                {value === "total" ? "総枚数から計算" : value === "additional" ? "追加購入を試算" : "予算から逆算"}
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
            ) : tab === "budget" ? (
              <BudgetForm onSubmit={handleBudgetSubmit} loading={state === "loading"} initialParams={initialParams} />
            ) : (
              <TotalForm onSubmit={handleTotalSubmit} loading={state === "loading"} initialTotal={initialAdditional} initialParams={initialParams} />
            )}
          </div>
        </div>

        {state === "loading" && (
          <div className="flex flex-col items-center gap-3 py-14">
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-blue-500 border-t-transparent" />
            <p className="text-sm text-gray-400">最適なプランを計算しています...</p>
          </div>
        )}

        {state === "error" && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
            <span className="mt-0.5 shrink-0 text-red-500">!</span>
            <div>
              <p className="text-sm font-medium text-red-800">エラーが発生しました</p>
              <p className="mt-0.5 text-xs text-red-600">{errorMsg}</p>
            </div>
          </div>
        )}

        {state === "result" && result && (
          <div className="space-y-4">
            {resultN !== null && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-4">
                <p className="text-sm text-blue-700">
                  この予算で購入できる最大枚数:
                  <span className="ml-2 text-lg font-bold text-blue-900">{resultN} 枚</span>
                </p>
              </div>
            )}

            <Summary result={result} />

            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
                <h2 className="text-sm font-semibold text-gray-800">購入プラン詳細</h2>
                <span className="tabular-nums text-xs text-gray-400">
                  {result.meta.timeMs} ms{!result.meta.exact && " / 近似"}
                </span>
              </div>
              <ResultTable orders={result.orders} />
            </div>

            <div className="space-y-1 px-1 text-xs text-gray-400">
              <p>通常クーポンは税込み注文金額で判定し、1注文につき1枚まで使う前提です。</p>
              <p>HMVスペシャルクーポンと通常クーポンは同時利用不可の前提で計算しています。</p>
              <p>スペシャルクーポン付与判定は注文金額ベース、付与額は利用後の支払額ベースで計算しています。</p>
            </div>

            {shareUrl && (
              <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3">
                <span className="flex-1 truncate font-mono text-xs text-gray-400">{shareUrl}</span>
                <button
                  onClick={handleCopy}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    copied ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
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
