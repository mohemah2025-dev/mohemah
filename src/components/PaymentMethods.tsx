import { Apple, Check, CreditCard, Smartphone } from "lucide-react";

export type PayGateway = { id: string; name: string; provider_key?: string | null; fee_percent?: number; test_mode?: boolean };


const ORDER = ["applepay", "googlepay", "mada", "visa"];

/** Sort gateways so Apple Pay, Google Pay, mada and Visa come first. */
export function sortGateways<T extends PayGateway>(list: T[]): T[] {
  const rank = (g: T) => { const i = ORDER.indexOf(g.provider_key ?? ""); return i === -1 ? 99 : i; };
  return [...list].sort((a, b) => rank(a) - rank(b));
}

const LABELS: Record<string, string> = { applepay: "Apple Pay", googlepay: "Google Pay", mada: "مدى", visa: "Visa / Mastercard", stcpay: "STC Pay" };

function Mark({ k }: { k?: string | null }) {
  switch (k) {
    case "applepay": return <span className="pay-mark pay-mark-apple"><Apple className="size-4" />Pay</span>;
    case "googlepay": return <span className="pay-mark pay-mark-google"><b>G</b>&nbsp;Pay</span>;
    case "mada": return <span className="pay-mark pay-mark-mada">mada</span>;
    case "visa": return <span className="pay-mark pay-mark-visa">VISA</span>;
    case "stcpay": return <span className="pay-mark pay-mark-stc"><Smartphone className="size-3.5" />stc pay</span>;
    default: return <span className="pay-mark pay-mark-default"><CreditCard className="size-4" /></span>;
  }
}

/** Tile picker for payment methods (Apple Pay, Google Pay, mada, Visa…). */
export function PaymentMethodPicker({ gateways, value, onChange, compact }: { gateways: PayGateway[]; value: string; onChange: (id: string) => void; compact?: boolean }) {
  if (!gateways.length) return <p className="mohemah-card p-3 text-xs text-muted-foreground">لا توجد وسيلة دفع مفعّلة حالياً</p>;
  return (
    <div role="radiogroup" aria-label="وسيلة الدفع" className={`grid gap-2 ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}>
      {sortGateways(gateways).map((g) => {
        const on = value === g.id;
        return (
          <button key={g.id} type="button" role="radio" aria-checked={on} onClick={() => onChange(g.id)}
            className={`relative flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-xl border bg-card p-2.5 text-center transition-all active:scale-[0.97] ${on ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/40"}`}>
            {on && <span className="absolute left-1.5 top-1.5 grid size-4 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="size-3" /></span>}
            <Mark k={g.provider_key} />
            <span className="text-[11px] font-semibold text-muted-foreground">{LABELS[g.provider_key ?? ""] ?? g.name}{g.test_mode ? " · تجريبي" : ""}</span>
          </button>
        );
      })}
    </div>
  );
}
