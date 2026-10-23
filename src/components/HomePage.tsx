import { Button } from "@/components/ui/button";
import { useState, useMemo, useEffect, useCallback } from "react";
import { Search, Star, Bell, X, ChevronLeft, Plus } from "lucide-react";
import { useNavigate, Link } from "@tanstack/react-router";
import { ServiceIcon } from "@/components/ServiceAppearance";
import { AppHeader } from "@/components/AppHeader";
import { AdSpace } from "@/components/AdSpace";
import { usePublicData, type LiveSub } from "@/lib/publicData";
import { useFavorites } from "@/lib/customerData";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/lib/api";
import { useMyOrders, statusLabel, modeLabel, fmtDate, fmtTime, timeAgo } from "@/lib/liveData";
import type { AppNotification } from "@/components/OrderAlerts";

const DELIVERY: Record<string, string> = { in_person: "حضوري", remote: "عن بُعد", both: "حضوري / عن بُعد" };

export function HomePage() {
  const { user } = useAuth();
  const { services, subs, settings } = usePublicData();
  const { favoriteIds, toggleFavorite } = useFavorites();
  const { orders } = useMyOrders();
  const [searchQuery, setSearchQuery] = useState("");
  const [showFavOnly, setShowFavOnly] = useState(false);
  const [showFavManager, setShowFavManager] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const navigate = useNavigate();

  const serviceOf = useMemo(() => Object.fromEntries(services.map((s) => [s.id, s])), [services]);
  const favoriteSubs = useMemo(() => subs.filter((s) => favoriteIds.includes(s.id)), [subs, favoriteIds]);
  const recommended = useMemo(() => subs.filter((s) => !favoriteIds.includes(s.id)).slice(0, 10), [subs, favoriteIds]);
  const searchResults = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return [];
    return subs.filter((s) => s.name.includes(q) || serviceOf[s.service_id]?.name.includes(q) || (s.description ?? "").includes(q)).slice(0, 20);
  }, [searchQuery, subs, serviceOf]);

  const loadNotifications = useCallback(async () => {
    if (!user) { setNotifications([]); return; }
    try { setNotifications(await api<AppNotification[]>("/api/me/notifications")); } catch { /* ignore */ }
  }, [user?.id]);
  useEffect(() => { loadNotifications(); const t = setInterval(loadNotifications, 30000); return () => clearInterval(t); }, [loadNotifications]);
  const unreadCount = notifications.filter((n) => !n.read).length;
  const markRead = async (ids: string[]) => {
    if (!ids.length) return;
    setNotifications((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, read: 1 } : n)));
    try { await api("/api/me/notifications/read", { body: { ids } }); } catch { /* ignore */ }
  };

  const openSub = (sub: LiveSub) => {
    setSearchQuery("");
    navigate({ to: "/services", search: { category: serviceOf[sub.service_id]?.name ?? "", subService: sub.name } });
  };
  const recent = (orders ?? []).slice(0, 3);

  const favoritesSection = (grid: boolean) => (
    <section className="mt-4 mohemah-card p-3" aria-label="خدماتي المفضلة">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-full bg-accent"><Star className="size-4 fill-primary text-primary" /></span>
          <h3 className="text-sm font-bold text-foreground">خدماتي المفضلة</h3>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{favoriteSubs.length}</span>
        </div>
        <Button variant="unstyled" size="unstyled" onClick={() => setShowFavManager(true)} className="flex items-center gap-0.5 text-xs font-semibold text-primary">إدارة<ChevronLeft className="size-3.5" /></Button>
      </div>
      {favoriteSubs.length === 0 ? (
        <div className="py-5 text-center">
          <p className="text-sm text-muted-foreground">لم تقم بإضافة أي خدمة للمفضلة بعد</p>
          <Button variant="unstyled" size="unstyled" onClick={() => navigate({ to: "/services", search: { category: "", subService: "" } })} className="mt-2 text-xs font-bold text-primary">تصفّح الخدمات</Button>
        </div>
      ) : (
        <div className={grid ? "grid grid-cols-3 gap-2" : "flex gap-2 overflow-x-auto hide-scrollbar pb-1"} dir="rtl">
          {favoriteSubs.map((fav) => (
            <Button variant="unstyled" size="unstyled" key={fav.id} onClick={() => openSub(fav)}
              className={`group relative flex flex-col items-center gap-1.5 rounded-xl border border-border bg-background p-2.5 text-center transition-all hover:border-primary/40 active:scale-95 ${grid ? "" : "w-[5.5rem] shrink-0"}`}>
              <Star className="absolute left-1.5 top-1.5 size-3 fill-primary text-primary" aria-hidden="true" />
              <ServiceIcon icon={fav.icon} color={fav.color ?? undefined} className="size-11" />
              <span className="w-full truncate text-xs font-bold">{fav.name}</span>
              <span className="w-full truncate text-[10px] text-muted-foreground">{serviceOf[fav.service_id]?.name}</span>
            </Button>
          ))}
        </div>
      )}
    </section>
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      <AppHeader />

      <div className="max-w-lg mx-auto px-4 -mt-2">
        <div className="flex items-center gap-2 mt-4">
          <Button variant="unstyled" size="unstyled" aria-label="الإشعارات" onClick={() => (user ? setShowNotifications(true) : navigate({ to: "/auth" }))}
            className="relative w-10 h-10 rounded-full bg-mohemah-coral flex items-center justify-center text-primary-foreground shrink-0 shadow-sm active:scale-95 transition-transform">
            <Bell className="w-4.5 h-4.5" />
            {unreadCount > 0 && <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-mohemah-blue text-primary-foreground text-xs font-bold flex items-center justify-center">{unreadCount}</span>}
          </Button>
          <Button variant="unstyled" size="unstyled" aria-label="المفضلة" aria-pressed={showFavOnly} onClick={() => setShowFavOnly(!showFavOnly)}
            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm active:scale-95 transition-transform ${showFavOnly ? "bg-accent text-primary" : "bg-muted text-muted-foreground"}`}>
            <Star className={`w-4.5 h-4.5 ${showFavOnly ? "text-primary fill-primary" : "text-muted-foreground"}`} />
          </Button>
          <div className="flex-1 relative">
            <input type="text" placeholder="بحث سريع (سباكة- كهرباء- تكييف...)" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-card border border-border rounded-xl py-2.5 px-4 pr-10 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-mohemah-blue/30 transition-shadow" dir="rtl" />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            {searchQuery && <Button variant="unstyled" size="unstyled" aria-label="مسح البحث" onClick={() => setSearchQuery("")} className="absolute left-8 top-1/2 -translate-y-1/2"><X className="w-4 h-4 text-muted-foreground" /></Button>}
          </div>
        </div>

        {searchQuery.trim() && (
          <div className="mt-2 mohemah-card p-2 max-h-72 overflow-y-auto z-20 relative">
            {searchResults.length === 0 ? <p className="text-center text-sm text-muted-foreground py-4">لا توجد نتائج لـ "{searchQuery}"</p> : searchResults.map((s) => (
              <div key={s.id} className="flex items-center gap-1">
                <Button variant="unstyled" size="unstyled" onClick={() => openSub(s)} className="flex-1 min-w-0 flex items-center gap-3 p-3 rounded-xl hover:bg-mohemah-light transition-colors text-right">
                  <ServiceIcon icon={s.icon} color={s.color ?? undefined} className="size-10" />
                  <div className="flex-1 min-w-0"><p className="text-sm font-bold truncate">{s.name}</p><p className="text-xs text-muted-foreground truncate">{serviceOf[s.service_id]?.name} · {DELIVERY[s.delivery_mode]}</p></div>
                  <ChevronLeft className="w-4 h-4 text-muted-foreground shrink-0" />
                </Button>
                <button onClick={() => toggleFavorite(s.id)} aria-label={`المفضلة: ${s.name}`} aria-pressed={favoriteIds.includes(s.id)} className="p-2">
                  <Star className={`w-4 h-4 ${favoriteIds.includes(s.id) ? "text-mohemah-gold fill-mohemah-gold" : "text-muted-foreground"}`} />
                </button>
              </div>
            ))}
          </div>
        )}

        {showFavOnly && !searchQuery.trim() && favoritesSection(true)}

        {!showFavOnly && !searchQuery.trim() && (
          <>
            {favoriteSubs.length > 0 && favoritesSection(false)}
            <AdSpace className="mt-5" />
            {settings?.welcome_customer && !user && <p className="mt-4 text-center text-xs text-muted-foreground">{settings.welcome_customer}</p>}

            <div className="mt-6">
              <Button variant="unstyled" size="unstyled" onClick={() => navigate({ to: "/services", search: { category: "", subService: "" } })}
                className="w-full mohemah-btn-primary py-3 text-base font-bold rounded-2xl flex items-center justify-center gap-3 shadow-lg hover:shadow-xl transition-all active:scale-[0.98]">
                <Plus className="size-5" />اطلب مهمة جديدة
              </Button>
            </div>

            {recommended.length > 0 && (
              <div className="mt-6">
                <h2 className="text-lg font-bold text-foreground border-b-2 border-mohemah-blue/20 pb-1 mb-3 inline-block">مهام مختارة لك</h2>
                <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2" dir="rtl">
                  {recommended.map((item) => (
                    <div key={item.id} role="button" tabIndex={0} onClick={() => openSub(item)} onKeyDown={(e) => e.key === "Enter" && openSub(item)}
                      className="mohemah-card min-w-[100px] flex flex-col items-center p-3 gap-2 transition-transform hover:scale-105 active:scale-95 relative cursor-pointer">
                      <button onClick={(e) => { e.stopPropagation(); toggleFavorite(item.id); }} aria-label={`أضف ${item.name} للمفضلة`} className="absolute top-1.5 left-1.5">
                        <Star className="w-3.5 h-3.5 text-muted-foreground/40" />
                      </button>
                      <ServiceIcon icon={item.icon} color={item.color ?? undefined} className="size-12" />
                      <span className="text-xs font-semibold whitespace-nowrap">{item.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {user && recent.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center justify-between border-b-2 border-mohemah-blue/20 pb-1 mb-4">
                  <h2 className="text-lg font-bold text-foreground">آخر طلباتي</h2>
                  <Link to="/orders" className="text-xs font-semibold text-primary">عرض الكل</Link>
                </div>
                <div className="space-y-3">
                  {recent.map((o) => {
                    const sub = subs.find((s) => s.id === o.sub_service_id);
                    const active = !["completed", "cancelled"].includes(o.status);
                    return (
                      <div key={o.id} className="mohemah-card p-4 flex items-center gap-3">
                        <ServiceIcon icon={sub?.icon ?? serviceOf[o.service_id ?? ""]?.icon} color={sub?.color ?? undefined} className="size-11 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate">{o.sub_service_name ?? o.service_name}</p>
                          <p className="text-xs text-muted-foreground truncate">{o.mode === "remote" ? "عن بُعد" : o.region} · {modeLabel(o.mode)}</p>
                          <p className="text-[11px] text-muted-foreground">{fmtDate(o.created_at)} · {fmtTime(o.created_at)}</p>
                        </div>
                        <div className="shrink-0 flex flex-col items-end gap-1">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${active ? "bg-mohemah-blue/10 text-mohemah-blue" : o.status === "completed" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>{statusLabel[o.status]}</span>
                          {active
                            ? <Link to="/orders" className="text-xs px-3 py-1 rounded-lg font-semibold mohemah-btn-coral">متابعة الطلب</Link>
                            : sub && <button onClick={() => openSub(sub)} className="text-xs px-3 py-1 rounded-lg font-semibold bg-mohemah-gray text-foreground">إعادة الطلب</button>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showFavManager && (
        <div className="fixed inset-0 bg-foreground/40 z-[60] flex items-end sm:items-center justify-center" onClick={() => setShowFavManager(false)}>
          <div className="bg-card rounded-t-3xl sm:rounded-2xl p-5 max-w-lg w-full mx-0 sm:mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <Button variant="unstyled" size="unstyled" aria-label="إغلاق" onClick={() => setShowFavManager(false)}><X className="w-5 h-5 text-muted-foreground" /></Button>
              <h2 className="text-lg font-bold">خدماتي المفضلة</h2>
              <div className="w-5" />
            </div>
            {favoriteSubs.length === 0 ? <p className="text-center text-sm text-muted-foreground py-8">لم تقم بإضافة أي خدمة للمفضلة بعد</p> : (
              <ul className="space-y-2">
                {favoriteSubs.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 rounded-xl border border-border p-2.5">
                    <Button variant="unstyled" size="unstyled" onClick={() => { setShowFavManager(false); openSub(s); }} className="flex min-w-0 flex-1 items-center gap-3 text-right">
                      <ServiceIcon icon={s.icon} color={s.color ?? undefined} className="size-10 shrink-0" />
                      <span className="min-w-0"><span className="block truncate text-sm font-bold">{s.name}</span><span className="block truncate text-xs text-muted-foreground">{serviceOf[s.service_id]?.name}</span></span>
                    </Button>
                    <Button variant="unstyled" size="unstyled" onClick={() => toggleFavorite(s.id)} aria-label={`إزالة ${s.name} من المفضلة`} className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10">إزالة</Button>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-muted-foreground text-center mt-4">لإضافة خدمات للمفضلة، اضغط النجمة بجانب أي خدمة فرعية</p>
          </div>
        </div>
      )}

      {showNotifications && (
        <div className="fixed inset-0 bg-foreground/40 z-[60] flex items-end sm:items-center justify-center" onClick={() => setShowNotifications(false)}>
          <div className="bg-card rounded-t-3xl sm:rounded-2xl max-w-lg w-full mx-0 sm:mx-4 max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 pb-3 border-b border-border">
              <Button variant="unstyled" size="unstyled" aria-label="إغلاق" onClick={() => setShowNotifications(false)}><X className="w-5 h-5 text-muted-foreground" /></Button>
              <h2 className="text-lg font-bold">الإشعارات</h2>
              <Button variant="unstyled" size="unstyled" onClick={() => markRead(notifications.filter((n) => !n.read).map((n) => n.id))} className="text-xs text-mohemah-blue font-semibold">قراءة الكل</Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {!notifications.length && <p className="text-center text-sm text-muted-foreground py-10">لا توجد إشعارات بعد</p>}
              {notifications.map((n) => (
                <Button variant="unstyled" size="unstyled" key={n.id}
                  onClick={() => { markRead([n.id]); if (n.link) { setShowNotifications(false); navigate({ to: n.link as "/" }); } }}
                  className={`w-full text-right p-3 rounded-xl transition-colors flex items-start gap-3 ${n.read ? "bg-card" : "bg-mohemah-blue/5 border border-mohemah-blue/10"}`}>
                  <div className="w-10 h-10 rounded-full bg-mohemah-light flex items-center justify-center shrink-0"><Bell className="size-4 text-primary" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 justify-between"><p className="text-sm font-bold truncate">{n.title}</p><span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(n.at)}</span></div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{n.body}</p>
                  </div>
                  {!n.read && <div className="w-2.5 h-2.5 rounded-full bg-mohemah-coral shrink-0 mt-1.5" />}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
