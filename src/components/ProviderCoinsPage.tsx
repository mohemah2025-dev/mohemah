import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Coins, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { PaymentMethodPicker, sortGateways, type PayGateway } from "@/components/PaymentMethods";

const packages = [
  { name: "البداية", coins: 10 },
  { name: "الأساسية", coins: 50 },
  { name: "المحترفين", coins: 100, featured: true },
  { name: "النخبة", coins: 500 },
];

export function ProviderCoinsPage() {
  const { user, refreshProfile } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [gateways, setGateways] = useState<PayGateway[]>([]);
  const [gw, setGw] = useState<string>("");
  const [coins, setCoins] = useState<number>(50);
  const [busy, setBusy] = useState(false);

  const [vat, setVat] = useState(15);
  const [testMode, setTestMode] = useState(true);
  const load = async () => {
    if (!user) return;
    try {
      const info = await api<{ balance: number; gateways: PayGateway[]; vat_percent: number; test_payments_enabled: boolean }>("/api/provider/billing");
      setBalance(info.balance);
      setVat(Number(info.vat_percent) || 0);
      setTestMode(!!info.test_payments_enabled);
      const list = sortGateways(info.gateways ?? []);
      setGateways(list);
      if (!gw && list[0]) setGw(list[0].id);
    } catch { /* ignore */ }
  };
  useEffect(() => { load(); }, [user?.id]);

  const total = coins * (1 + vat / 100);
  const pay = async () => {
    if (!gw) return toast.error("اختر وسيلة الدفع");
    setBusy(true);
    try {
      const r = await api<{ balance: number }>("/api/provider/topup", { body: { coins, gateway_id: gw } });
      setBalance(r.balance);
      refreshProfile();
      toast.success(`تم شحن ${coins} كوين بنجاح`);
    } catch (e) { toast.error(errMsg(e, "تعذر الشحن")); }
    setBusy(false);
  };

  return (
    <div className="min-h-screen bg-background pb-24" dir="rtl">
      <header className="mohemah-header-gradient text-primary-foreground px-4 pt-8 pb-5">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <Link to="/provider/account" className="opacity-90" aria-label="رجوع"><ChevronRight className="w-6 h-6" /></Link>
          <h1 className="text-lg font-bold">شحن الرصيد</h1>
          <div className="w-6" />
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 mt-4 space-y-4">
        {!user ? (
          <div className="mohemah-card p-5 text-center text-sm">
            يجب تسجيل الدخول لشحن الرصيد.
            <Link to="/provider/auth" className="mohemah-btn-coral block mt-3 py-2">تسجيل الدخول</Link>
          </div>
        ) : (
          <>
            <div className="mohemah-card p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">رصيدك الحالي</p>
                <p className="text-2xl font-bold">{balance ?? "…"} <span className="text-sm font-semibold text-muted-foreground">كوين</span></p>
              </div>
              <span className="grid size-12 place-items-center rounded-full bg-accent"><Coins className="size-6 text-primary" /></span>
            </div>

            <section>
              <h2 className="text-sm font-bold mb-2">اختر الكمية</h2>
              <div className="grid grid-cols-4 gap-2">
                {packages.map((p) => (
                  <button key={p.coins} type="button" onClick={() => setCoins(p.coins)} aria-pressed={coins === p.coins}
                    className={`relative rounded-xl border bg-card p-2 text-center transition-all active:scale-95 ${coins === p.coins ? "border-primary ring-2 ring-primary/30" : "border-border"}`}>
                    {p.featured && <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-primary px-1.5 text-[9px] font-bold text-primary-foreground">الأكثر</span>}
                    <p className="text-base font-bold">{p.coins}</p>
                    <p className="text-[10px] text-muted-foreground">{p.name}</p>
                  </button>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <label htmlFor="custom-coins" className="text-xs text-muted-foreground shrink-0">كمية أخرى</label>
                <input id="custom-coins" type="number" min={1} max={10000} value={coins} dir="ltr"
                  onChange={(e) => setCoins(Math.max(1, Math.min(10000, Number(e.target.value) || 1)))}
                  className="w-full border border-border rounded-xl px-3 py-2 bg-background text-center text-sm" />
              </div>
            </section>

            <section>
              <h2 className="text-sm font-bold mb-2">وسيلة الدفع</h2>
              <PaymentMethodPicker gateways={gateways} value={gw} onChange={setGw} />
            </section>

            <div className="mohemah-card p-4 space-y-3">
              <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">{coins} كوين + ضريبة {vat}%</span><span className="text-lg font-bold">{total.toFixed(2)} ر.س</span></div>
              <button disabled={busy || !gw} onClick={pay} className="w-full mohemah-btn-primary py-3 text-sm font-bold disabled:opacity-50">
                {busy ? "جاري الدفع…" : `ادفع ${total.toFixed(2)} ر.س`}
              </button>
              <p className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground"><ShieldCheck className="size-3.5" />{testMode ? "الدفع حالياً تجريبي للاختبار — لا يُخصم أي مبلغ" : "دفع آمن"}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
