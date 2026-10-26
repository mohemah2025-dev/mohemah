import { Button } from "@/components/ui/button";
import { useState } from "react";
import { MapPin, ChevronDown } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import logo from "@/assets/mohemah-logo-new.png";
import { useAuth } from "@/lib/AuthContext";
import { usePublicData } from "@/lib/publicData";
import { fileUrl, api, errMsg } from "@/lib/api";
import { notifyAddressesChanged, useAddresses } from "@/lib/customerData";

export function AppHeader() {
  const { user, profile } = useAuth();
  const { settings } = usePublicData();
  const { addresses, defaultAddress } = useAddresses();
  const [showAddresses, setShowAddresses] = useState(false);
  const navigate = useNavigate();
  const firstName = (profile?.full_name ?? "").split(/\s+/)[0];
  const place = defaultAddress ? `${defaultAddress.region ?? ""} - ${defaultAddress.label}` : profile?.region ?? "أضف عنوانك";

  const choose = async (id: string) => {
    setShowAddresses(false);
    try { await api(`/api/me/addresses/${id}/default`, { method: "POST" }); notifyAddressesChanged(); } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <>
      <header className="mohemah-header-gradient text-foreground px-4 pt-4 pb-3">
        <div className="max-w-lg mx-auto grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
          <img src={settings?.app_logo_url ? fileUrl(settings.app_logo_url) : logo} alt={settings?.app_name ?? "تطبيق مهمة"} width={56} height={56} className="w-14 h-14 shrink-0 object-contain" />
          <div className="flex min-w-0 items-center justify-end gap-3">
            {user ? (
              <div className="min-w-0 text-left">
                <p className="text-sm font-bold">أهلاً {firstName}</p>
                <Button variant="unstyled" size="unstyled" onClick={() => setShowAddresses(true)}
                  className="flex max-w-full min-w-0 items-center gap-1 text-xs opacity-90 hover:opacity-100 transition-opacity">
                  <MapPin className="w-3 h-3" />
                  <span className="truncate">{place}</span>
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </div>
            ) : (
              <Link to="/auth" className="rounded-full bg-card/90 px-4 py-2 text-xs font-bold text-primary shadow-sm">تسجيل الدخول</Link>
            )}
            <Link to="/account" aria-label="حسابي" className="w-10 h-10 shrink-0 rounded-full bg-accent text-primary flex items-center justify-center">
              <UserIcon className="w-6 h-6" />
            </Link>
          </div>
        </div>
      </header>

      {showAddresses && (
        <div className="fixed inset-0 bg-foreground/40 z-50 flex items-end sm:items-center justify-center" onClick={() => setShowAddresses(false)}>
          <div className="bg-card rounded-t-3xl sm:rounded-2xl p-5 max-w-lg w-full mx-0 sm:mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <Button variant="unstyled" size="unstyled" onClick={() => setShowAddresses(false)} className="text-sm text-muted-foreground">إغلاق</Button>
              <h2 className="text-lg font-bold">اختر العنوان</h2>
              <div className="w-10" />
            </div>
            <div className="space-y-2">
              {!addresses.length && <p className="text-center text-sm text-muted-foreground py-4">لم تضف أي عنوان بعد</p>}
              {addresses.map((addr) => (
                <Button variant="unstyled" size="unstyled" key={addr.id} onClick={() => choose(addr.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-right ${addr.is_default ? "bg-mohemah-blue/10 ring-2 ring-mohemah-blue" : "bg-mohemah-light hover:bg-mohemah-gray"}`}>
                  <MapPin className="w-4 h-4 text-mohemah-coral shrink-0" />
                  <div className="flex-1 text-right min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold">{addr.label}</p>
                      {!!addr.is_default && <span className="text-xs px-2 py-0.5 rounded-full bg-mohemah-blue/10 text-mohemah-blue font-semibold">افتراضي</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{[addr.region, addr.address].filter(Boolean).join(" - ")}</p>
                  </div>
                </Button>
              ))}
            </div>
            <Button variant="unstyled" size="unstyled" onClick={() => { setShowAddresses(false); navigate({ to: "/account", hash: "addresses" }); }}
              className="w-full mt-3 text-center text-sm text-mohemah-blue font-semibold py-2">
              إدارة العناوين
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

function UserIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
