import { CircleCheck, CircleX, Star, Timer } from "lucide-react";
import { useMemo } from "react";
import { useProviderStats } from "./ProviderContext";
import { timeAgo } from "@/lib/liveData";
import { useAuth } from "@/lib/AuthContext";
import { ProviderApplicationStatus } from "./ProviderApplication";

const DAY_NAMES = ["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];
const EVENT: Record<string, { label: string; dot: string }> = {
  completed: { label: "تم إكمال", dot: "bg-green-500" },
  accepted: { label: "تم قبول", dot: "bg-mohemah-blue" },
  arrived: { label: "وصلت لموقع", dot: "bg-mohemah-blue" },
  in_progress: { label: "جارٍ تنفيذ", dot: "bg-mohemah-gold" },
  cancelled: { label: "أُلغي", dot: "bg-destructive" },
};

export function ProviderActivityPage() {
  const { isProvider } = useAuth();
  const stats = useProviderStats();

  // Last 7 days in Riyadh time, oldest first.
  const week = useMemo(() => {
    const out: { key: string; label: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() + 3 * 3600000 - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      out.push({ key, label: DAY_NAMES[d.getUTCDay()], count: stats?.weekly.find((w) => w.day === key)?.count ?? 0 });
    }
    return out;
  }, [stats]);
  const max = Math.max(1, ...week.map((d) => d.count));

  const cards = [
    { label: "مهام مكتملة", value: stats?.completed ?? 0, icon: CircleCheck },
    { label: "مهام ملغاة", value: stats?.cancelled ?? 0, icon: CircleX },
    { label: "متوسط التقييم", value: stats?.rating_count ? stats.rating.toFixed(1) : "—", icon: Star },
    { label: "ساعات العمل", value: stats?.work_hours ?? 0, icon: Timer },
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="mohemah-header-gradient text-primary-foreground px-4 pt-8 pb-5">
        <h1 className="max-w-lg mx-auto text-xl font-bold text-center">النشاط</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 mt-3">
        {!isProvider && <div className="mb-3"><ProviderApplicationStatus /></div>}
        <div className="grid grid-cols-2 gap-3">
          {cards.map((s) => (
            <div key={s.label} className="mohemah-card p-4 text-center">
              <s.icon className="size-5 mx-auto text-primary" />
              <p className="text-xl font-bold text-foreground mt-1 tabular-nums">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="mohemah-card mt-4 p-4">
          <h3 className="text-sm font-bold text-right mb-4">المهام المكتملة آخر 7 أيام</h3>
          <div className="provider-chart flex items-end gap-1 sm:gap-2 justify-center h-36" role="img" aria-label="عدد المهام المكتملة لكل يوم">
            {week.map((day) => (
              <div key={day.key} className="flex h-full min-w-0 flex-col justify-end items-center gap-2 flex-1">
                <span className="text-xs font-bold text-mohemah-blue tabular-nums">{day.count}</span>
                <div className={`w-full max-w-8 rounded-t-sm ${day.count ? "bg-primary" : "bg-mohemah-gray"}`} style={{ height: `${Math.max((day.count / max) * 66, 4)}%` }} />
                <span className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">{day.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mohemah-card mt-4 p-4">
          <h3 className="text-sm font-bold text-right mb-3">آخر النشاطات</h3>
          {!stats?.recent.length ? <p className="text-xs text-muted-foreground text-center py-4">لا يوجد نشاط بعد</p> : (
            <div className="space-y-3">
              {stats.recent.map((item) => {
                const e = EVENT[item.status] ?? EVENT.accepted;
                return (
                  <div key={item.id} className="flex items-center gap-3 p-2 rounded-xl bg-mohemah-light">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${e.dot}`} />
                    <div className="flex-1 text-right min-w-0">
                      <p className="text-sm font-semibold truncate">{e.label} مهمة {item.sub_service_name ?? item.service_name}{item.rating ? ` · ⭐ ${item.rating}` : ""}</p>
                      <p className="text-xs text-muted-foreground">{item.at ? timeAgo(item.at) : ""}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
