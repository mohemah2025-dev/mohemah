import { useState, useEffect, useRef } from "react";
import { useSearch } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { Camera, Send, Star, ChevronRight, X, LocateFixed, Clock, UserRound } from "lucide-react";
import { useLiveServices, type LiveSub, type CustomerOrder } from "@/lib/liveData";
import { usePublicData } from "@/lib/publicData";
import { useAddresses, useFavorites } from "@/lib/customerData";
import { api, errMsg } from "@/lib/api";
import { ServiceIcon } from "@/components/ServiceAppearance";
import { normalizedIcon, serviceIcons } from "@/lib/serviceAppearance";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";

type Cat = { id: string; name: string; description?: string | null; icon?: string | null; subServices: string[]; subIds?: Record<string, string>; color?: string; coinPrice?: number; subs?: LiveSub[] };

export function ServicesPage() {
  const { services: live, loading } = useLiveServices();
  const { regions } = usePublicData();
  const { user, profile } = useAuth();
  const { addresses, defaultAddress } = useAddresses();
  const { isFavorite, toggleFavorite } = useFavorites();
  const navigate = useNavigate();
  const categories: Cat[] = live.map((s) => ({ id: s.id, name: s.name, description: s.description, icon: s.icon, color: s.color, coinPrice: s.coin_price, subs: s.subs, subServices: s.subs.map((x) => x.name), subIds: Object.fromEntries(s.subs.map((x) => [x.name, x.id])) }));
  const search = useSearch({ strict: false }) as { category?: string; subService?: string } | undefined;
  const selectedCategory = categories.find((cat) => cat.name === search?.category) ?? null;
  const selectedSubService = selectedCategory?.subServices.includes(search?.subService ?? "") ? search!.subService! : null;
  const selectService = (category: string = "", subService: string = "") => {
    void navigate({ to: "/services", search: { category, subService }, resetScroll: false });
  };
  const BannerIcon = serviceIcons[normalizedIcon(selectedCategory?.icon)] ?? serviceIcons.Wrench;
  const [serviceType, setServiceType] = useState<"حضوري" | "عن بُعد">("حضوري");
  const selectedSub = selectedCategory?.subs?.find((x) => x.name === selectedSubService);
  const subMode = selectedSub?.delivery_mode ?? "both";
  useEffect(() => { if (subMode === "remote") setServiceType("عن بُعد"); else if (subMode === "in_person") setServiceType("حضوري"); }, [subMode]);
  const [notes, setNotes] = useState("");
  const [addressId, setAddressId] = useState<string>("");
  const [newAddr, setNewAddr] = useState({ region: "", address: "", lat: null as number | null, lng: null as number | null });
  const [when, setWhen] = useState<"now" | "later">("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [placed, setPlaced] = useState<{ id: string; order_no: number } | null>(null);
  const [placedOrder, setPlacedOrder] = useState<CustomerOrder | null>(null);
  const [waitedOut, setWaitedOut] = useState(false);
  const formRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { if (!addressId && defaultAddress) setAddressId(defaultAddress.id); }, [defaultAddress?.id]);
  useEffect(() => { if (!newAddr.region && profile?.region) setNewAddr((a) => ({ ...a, region: profile.region ?? "" })); }, [profile?.region]);

  useEffect(() => {
    if (selectedCategory) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [selectedCategory?.id]);

  useEffect(() => {
    if (selectedSubService) formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selectedCategory?.id, selectedSubService]);

  // After sending, watch the order until a provider accepts (or stop waiting after 45 seconds).
  useEffect(() => {
    if (!placed) return;
    const started = Date.now();
    let stop = false;
    const tick = async () => {
      try {
        const list = await api<CustomerOrder[]>("/api/orders/mine");
        const o = list.find((x) => x.id === placed.id);
        if (stop || !o) return;
        if (o.status !== "pending") { setPlacedOrder(o); stop = true; return; }
      } catch { /* ignore */ }
      if (Date.now() - started > 45000) { setWaitedOut(true); stop = true; }
    };
    const t = setInterval(() => { if (!stop) tick(); }, 3000);
    return () => { stop = true; clearInterval(t); };
  }, [placed?.id]);

  const toggleSubFavorite = (subName: string) => {
    const id = selectedCategory?.subIds?.[subName];
    if (id) toggleFavorite(id);
  };
  const isSubFavorite = (subName: string) => {
    const id = selectedCategory?.subIds?.[subName];
    return id ? isFavorite(id) : false;
  };

  const useMyLocation = () => {
    if (!("geolocation" in navigator)) return toast.error("المتصفح لا يدعم تحديد الموقع");
    navigator.geolocation.getCurrentPosition(
      (p) => { setNewAddr((a) => ({ ...a, lat: Number(p.coords.latitude.toFixed(6)), lng: Number(p.coords.longitude.toFixed(6)) })); toast.success("تم تحديد موقعك"); },
      () => toast.error("تعذّر تحديد الموقع، اسمح للتطبيق بالوصول للموقع"),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleSubmit = async () => {
    if (!user) { toast.error("سجّل دخولك لإرسال الطلب"); navigate({ to: "/auth" }); return; }
    if (!selectedSub) { toast.error("اختر الخدمة الفرعية"); return; }
    const mode = serviceType === "عن بُعد" ? "remote" : "in_person";
    const saved = addresses.find((a) => a.id === addressId);
    const useSaved = mode === "in_person" && saved && addressId !== "new";
    const region = useSaved ? saved!.region : newAddr.region || profile?.region;
    if (!region) { toast.error("اختر المدينة"); return; }
    if (mode === "in_person" && !useSaved && newAddr.address.trim().length < 3) { toast.error("اكتب عنوان تنفيذ الخدمة (الحي والشارع)"); return; }
    if (notes.trim().length < 5) { toast.error("اكتب شرحاً مختصراً للطلب"); return; }
    if (when === "later" && !scheduledAt) { toast.error("حدد موعد التنفيذ"); return; }
    setSubmitting(true);
    try {
      const r = await api<{ id: string; order_no: number }>("/api/orders", { body: {
        sub_service_id: selectedSub.id, mode, description: notes.trim(), region,
        address: mode === "in_person" ? (useSaved ? `${saved!.label}: ${saved!.address}` : newAddr.address.trim()) : null,
        lat: mode === "in_person" ? (useSaved ? saved!.lat : newAddr.lat) : null,
        lng: mode === "in_person" ? (useSaved ? saved!.lng : newAddr.lng) : null,
        scheduled_at: when === "later" ? new Date(scheduledAt).toISOString() : null,
      } });
      setPlacedOrder(null); setWaitedOut(false); setPlaced(r);
      setNotes("");
    } catch (e) { toast.error(errMsg(e, "تعذّر إرسال الطلب")); }
    setSubmitting(false);
  };

  const closePlaced = (toOrders: boolean) => {
    setPlaced(null); setPlacedOrder(null); setWaitedOut(false);
    if (toOrders) navigate({ to: "/orders" }); else selectService();
  };

  const handleReset = () => {
    selectService();
    setNotes("");
    setServiceType("حضوري");
  };

  const serviceForm = selectedSubService && selectedCategory ? (
    <div ref={formRef} className="min-w-0 scroll-mt-24 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="mohemah-card p-3 flex items-center justify-between">
        <button onClick={() => selectService(selectedCategory.name)} aria-label="إغلاق نموذج الطلب">
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
          <ServiceIcon icon={selectedSub?.icon} color={selectedSub?.color ?? undefined} className="size-10" />
          <span className="text-sm font-bold">{selectedSubService}</span>
          <span className="text-xs text-muted-foreground">({selectedCategory?.name})</span>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => setServiceType("حضوري")}
          disabled={subMode === "remote"}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40 ${
            serviceType === "حضوري" ? "rounded-xl bg-primary text-primary-foreground" : "bg-muted text-foreground"
          }`}
        >
          حضوري
        </button>
        <button
          onClick={() => setServiceType("عن بُعد")}
          disabled={subMode === "in_person"}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40 ${
            serviceType === "عن بُعد" ? "rounded-xl bg-primary text-primary-foreground" : "bg-muted text-foreground"
          }`}
        >
          عن بُعد
        </button>
      </div>

      {serviceType === "حضوري" ? (
        <div className="mohemah-card p-3 space-y-2">
          <h3 className="text-sm font-bold">عنوان تنفيذ الخدمة</h3>
          {addresses.length > 0 && (
            <select value={addressId} onChange={(e) => setAddressId(e.target.value)} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm">
              {addresses.map((a) => <option key={a.id} value={a.id}>{a.label} — {[a.region, a.address].filter(Boolean).join(" - ")}</option>)}
              <option value="new">عنوان آخر…</option>
            </select>
          )}
          {(!addresses.length || addressId === "new") && (
            <div className="space-y-2">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                <select value={newAddr.region} onChange={(e) => setNewAddr({ ...newAddr, region: e.target.value })} className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm">
                  <option value="">المدينة</option>{regions.map((r) => <option key={r}>{r}</option>)}
                </select>
                <button type="button" onClick={useMyLocation} className={`flex items-center gap-1 rounded-xl px-3 text-xs font-bold ${newAddr.lat ? "bg-success/10 text-success" : "bg-accent text-primary"}`}><LocateFixed className="size-4" />{newAddr.lat ? "تم تحديد موقعك" : "موقعي الحالي"}</button>
              </div>
              <input value={newAddr.address} onChange={(e) => setNewAddr({ ...newAddr, address: e.target.value })} maxLength={300} placeholder="الحي - الشارع - رقم المنزل" className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm" />
              {user && <p className="text-[11px] text-muted-foreground">يمكنك حفظ عناوينك من صفحة الحساب لاستخدامها لاحقاً.</p>}
            </div>
          )}
        </div>
      ) : (
        <div className="mohemah-card p-3 flex items-center justify-between gap-2">
          <span className="text-sm font-bold">مدينتك</span>
          <select value={newAddr.region} onChange={(e) => setNewAddr({ ...newAddr, region: e.target.value })} className="rounded-xl border border-border bg-background px-3 py-2 text-sm">
            <option value="">اختر</option>{regions.map((r) => <option key={r}>{r}</option>)}
          </select>
        </div>
      )}

      <div className="mohemah-card p-3 space-y-2">
        <h3 className="text-sm font-bold">موعد التنفيذ</h3>
        <div className="grid grid-cols-2 gap-2">
          {([["now", "في أقرب وقت"], ["later", "تحديد موعد"]] as const).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setWhen(k)} aria-pressed={when === k} className={`py-2 rounded-xl text-sm font-bold ${when === k ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{label}</button>
          ))}
        </div>
        {when === "later" && <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm" dir="ltr" />}
      </div>

      <div>
        <h3 className="text-sm font-bold text-right mb-2">شرح الطلب</h3>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000}
          className="w-full mohemah-card p-3 min-h-[100px] text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="اكتب تفاصيل طلبك هنا..." dir="rtl" />
        <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground"><Camera className="size-3.5" />إرفاق الصور والرسائل الصوتية يصل مع نسخة الجوال القادمة</p>
      </div>

      <button onClick={handleSubmit} disabled={submitting}
        className="w-full rounded-xl bg-primary text-primary-foreground py-3.5 text-base font-bold flex items-center justify-center gap-2 shadow-lg disabled:opacity-60">
        <Send className="w-5 h-5" />{submitting ? "جارٍ الإرسال…" : "ارسل الطلب"}
      </button>
      <p className="text-center text-[11px] text-muted-foreground">لا يأخذ التطبيق أي رسوم من طالب الخدمة، وتتفق مع مقدم الخدمة على قيمة التنفيذ.</p>

      <button onClick={handleReset} className="w-full text-center text-sm text-muted-foreground py-2">
        إلغاء
      </button>
    </div>
  ) : null;

  return (
    <div className="min-h-screen bg-background pb-24">
      <AppHeader />
      <main dir="rtl" className="mx-auto mt-6 w-full max-w-5xl min-w-0 px-4">
        {!selectedCategory ? (
          <>
            <h2 className="mb-6 border-b border-border pb-2 text-xl font-bold">اختر المهمة المطلوبة</h2>
            {!loading && !categories.length && <p className="mohemah-card p-6 text-center text-sm text-muted-foreground">لا توجد خدمات متاحة حالياً، عُد قريباً</p>}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {categories.map((cat) => (
                <Button
                  key={cat.id}
                  variant="ghost"
                  onClick={() => selectService(cat.name)}
                  data-service-color={cat.color ?? "blue"}
                  className="service-item mohemah-card flex h-auto min-h-[180px] min-w-0 flex-col items-start justify-start gap-3 overflow-hidden whitespace-normal border border-border bg-card p-4 text-right text-foreground transition-all hover:bg-accent active:scale-95"
                >
                  <ServiceIcon icon={cat.icon} color={cat.color} className="size-12 shrink-0" />
                  <span className="w-full truncate text-sm font-bold">{cat.name}</span>
                  <span className="line-clamp-2 text-xs font-normal text-muted-foreground">{cat.description || "اختر الخدمة الفرعية المناسبة وأكمل طلبك بسهولة"}</span>
                  <span className="mt-auto text-xs text-muted-foreground">{cat.subServices.length} خدمات فرعية</span>
                </Button>
              ))}
            </div>
          </>
        ) : (
          <>
            <section className="service-banner relative overflow-hidden rounded-2xl bg-primary px-5 pb-12 pt-4 text-primary-foreground">
              <button onClick={() => selectService()} className="relative z-10 mb-4 inline-flex items-center gap-1 rounded-lg py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2">
                <ChevronRight className="size-4" />
                الخدمات
              </button>
              <div className="relative z-10 min-w-0 pl-16">
                <h2 className="break-words text-xl font-bold">{selectedCategory.name}</h2>
                <p className="mt-2 text-sm opacity-90">{selectedCategory.description || "اختر الخدمة الفرعية المناسبة وأكمل طلبك بسهولة"}</p>
                <p className="mt-3 text-xs">{selectedCategory.subServices.length} خدمات فرعية</p>
              </div>
              <div aria-hidden="true" className="service-banner-icon pointer-events-none absolute bottom-3 left-2 -rotate-[15deg] opacity-20">
                <BannerIcon className="h-24 w-24" />
              </div>
            </section>
            <section className="relative z-10 -mt-4 min-w-0 rounded-t-2xl bg-background px-2 py-5 sm:px-4">
              <h3 className="mb-4 text-lg font-bold">الخدمات الفرعية</h3>
              <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {selectedCategory.subServices.map((sub) => {
                  const details = selectedCategory.subs?.find((item) => item.name === sub);
                  return (
                    <div key={sub} className="relative min-w-0">
                      <Button
                        variant="outline"
                        aria-pressed={selectedSubService === sub}
                        onClick={() => selectService(selectedCategory.name, sub)}
                        data-service-color={details?.color ?? selectedCategory.color ?? "blue"}
                        className={`service-item mohemah-card h-auto min-h-24 w-full min-w-0 justify-start gap-3 whitespace-normal rounded-xl py-4 pl-10 pr-3 text-right ${selectedSubService === sub ? "bg-accent ring-2 ring-ring" : "bg-card hover:bg-accent"}`}
                      >
                        <ServiceIcon icon={details?.icon} color={details?.color ?? selectedCategory.color} className="size-10 shrink-0" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold">{sub}</span>
                          {details && <span className="mt-1 block text-xs text-muted-foreground">{({ in_person: "حضوري", remote: "عن بُعد", both: "حضوري / عن بُعد" } as Record<string, string>)[details.delivery_mode ?? "both"]}</span>}
                        </span>
                      </Button>
                      <button
                        onClick={() => toggleSubFavorite(sub)}
                        aria-label={`المفضلة: ${sub}`}
                        aria-pressed={isSubFavorite(sub)}
                        className="absolute left-1 top-1 rounded-lg p-2"
                      >
                        <Star className={`size-4 ${isSubFavorite(sub) ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                      </button>
                    </div>
                  );
                })}
              </div>
              {serviceForm}
            </section>
          </>
        )}
      </main>

      {placed && (
        <div className="fixed inset-0 bg-foreground/40 z-50 flex items-end sm:items-center justify-center pb-24 sm:pb-0">
          <div className="bg-card rounded-t-3xl sm:rounded-2xl p-6 max-w-lg w-full mx-4 text-center">
            {!placedOrder && !waitedOut && (
              <>
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-accent flex items-center justify-center"><div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" /></div>
                <p className="font-bold text-lg">جاري البحث عن مقدم خدمة</p>
                <p className="text-sm text-muted-foreground mt-1">تم إرسال طلبك #{placed.order_no} لمقدمي الخدمة في خدمتك ومدينتك</p>
                <button onClick={() => closePlaced(true)} className="mt-5 text-sm font-bold text-primary">متابعة من صفحة الطلبات</button>
              </>
            )}
            {waitedOut && !placedOrder && (
              <>
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-mohemah-blue/10 grid place-items-center"><Clock className="size-7 text-mohemah-blue" /></div>
                <p className="font-bold text-lg">طلبك منشور لمقدمي الخدمة</p>
                <p className="text-sm text-muted-foreground mt-1">لم يُقبل بعد، وسنشعرك فور قبوله. يمكنك متابعته أو إلغاؤه من صفحة الطلبات.</p>
                <div className="flex gap-3 mt-5">
                  <button onClick={() => closePlaced(true)} className="flex-1 rounded-xl bg-primary text-primary-foreground py-3">صفحة الطلبات</button>
                  <button onClick={() => closePlaced(false)} className="flex-1 rounded-xl bg-secondary text-secondary-foreground py-3">إغلاق</button>
                </div>
              </>
            )}
            {placedOrder?.provider && (
              <div className="text-right">
                <p className="text-center font-bold text-lg text-success mb-4">تم قبول طلبك</p>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center"><UserRound className="size-7 text-primary" /></div>
                  <div className="flex-1">
                    <p className="font-bold text-primary">{placedOrder.provider.name ?? "مقدم الخدمة"}</p>
                    <p className="text-xs text-muted-foreground">{placedOrder.provider.nationality ?? ""}</p>
                  </div>
                  {!!placedOrder.provider.rating_count && <div className="flex items-center gap-1"><span className="text-sm font-bold">{Number(placedOrder.provider.rating).toFixed(1)}</span><Star className="w-5 h-5 text-primary fill-primary" /></div>}
                </div>
                <p className="text-sm text-muted-foreground mb-4">{placedOrder.sub_service_name ?? placedOrder.service_name} · {placedOrder.mode === "remote" ? "عن بُعد" : placedOrder.region}</p>
                <div className="mohemah-card p-3 mb-4 text-sm text-muted-foreground">قيمة التنفيذ: تتفق عليها مع مقدم الخدمة عبر المراسلة</div>
                <button onClick={() => closePlaced(true)} className="w-full rounded-xl bg-primary text-primary-foreground py-3">متابعة الطلب والمراسلة</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
