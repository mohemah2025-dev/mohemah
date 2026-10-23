import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, Star, LogOut, Coins, FileText, Shield, CalendarClock, Briefcase } from "lucide-react";
import { useProviderStats, LOYALTY_TIERS, currentTierIndex } from "./ProviderContext";
import { useAuth } from "@/lib/AuthContext";
import { useSubscriptionDaysLeft, ProviderBillingStatus } from "./ProviderBilling";

const menuItems = [
  { id: "profile", label: "الملف الشخصي", icon: "👤", desc: "تعديل بياناتك الشخصية" },
  { id: "payments", label: "مراجعة المدفوعات", icon: "💳", desc: "سجل المدفوعات والإحصائيات" },
  { id: "ratings", label: "التقييمات", icon: "⭐", desc: "عرض تقييمات العملاء" },
  { id: "packages", label: "الباقات والاشتراك", icon: "🏆", desc: "باقات الاشتراك وطريقة الدفع" },
  { id: "help", label: "مركز المساعدة", icon: "❓", desc: "الأسئلة الشائعة والدعم" },
  { id: "about", label: "عن التطبيق", icon: "ℹ️", desc: "معلومات عن تطبيق مهمة" },
];

export function ProviderAccountPage() {
  const { profile, signOut, isProvider } = useAuth();
  const navigate = useNavigate();
  const stats = useProviderStats();
  const subDays = useSubscriptionDaysLeft();
  const coins = profile?.coin_balance ?? 0;
  const rating = profile?.rating_count ? profile.rating.toFixed(1) : "—";
  const tier = LOYALTY_TIERS[currentTierIndex(stats?.completed ?? 0, stats?.rating ?? 0)].name;
  const logout = async () => { await signOut(); navigate({ to: "/provider/auth" }); };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="mohemah-header-gradient text-primary-foreground px-4 pt-6 pb-8">
        <div className="max-w-lg mx-auto text-center">
          {/* Subscription & coins — two squares side by side, above the profile */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Link
              to="/provider/billing"
              className="rounded-2xl bg-card/20 p-3 flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform"
            >
              <CalendarClock className="w-6 h-6" />
              <span className="text-xl font-bold leading-none">{subDays !== null ? subDays : "—"}</span>
              <span className="text-[11px] opacity-90">{subDays !== null ? "يوم متبقٍ بالاشتراك" : "اشتراك"}</span>
            </Link>
            <Link
              to="/provider/coins"
              className="rounded-2xl bg-card/20 p-3 flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform"
            >
              <Coins className="w-6 h-6 text-mohemah-gold" />
              <span className="text-xl font-bold leading-none">{coins}</span>
              <span className="text-[11px] opacity-90">كوينز</span>
            </Link>
          </div>
          <div className="w-20 h-20 rounded-full bg-card/20 flex items-center justify-center mx-auto mb-3">
            <UserIcon className="w-12 h-12" />
          </div>
          <h2 className="text-lg font-bold">{profile?.full_name || "مقدم خدمة"}</h2>
          <div className="flex items-center justify-center gap-1 mt-1">
            <span className="text-sm">{rating}</span>
            <Star className="w-4 h-4 fill-mohemah-gold text-mohemah-gold" />
          </div>
          <p className="text-xs opacity-80 mt-1">{isProvider ? `مستوى ${tier}` : profile?.verification_status === "pending" ? "طلب التسجيل قيد المراجعة" : "غير مفعّل كمقدم خدمة"}</p>
        </div>
      </div>


      <div className="max-w-lg mx-auto px-4 -mt-4">
        <div className="mt-2 space-y-2">
          <ProviderBillingStatus subscriptionOnly />
          <Link to="/provider/services" className="w-full mohemah-card p-4 flex items-center gap-3">
            <ChevronLeft className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="flex-1 text-right">
              <p className="text-sm font-bold">خدماتي والرسائل</p>
              <p className="text-xs text-muted-foreground">اختيار الخدمات التي تقدمها والرد على الرسائل</p>
            </div>
            <Briefcase className="w-5 h-5 text-mohemah-blue" />
          </Link>
          {menuItems.map((item) => (
            <Link
              key={item.id}
              to="/provider/account/$section"
              params={{ section: item.id }}
              className="w-full mohemah-card p-4 flex items-center gap-3"
            >
              <ChevronLeft className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex-1 text-right">
                <p className="text-sm font-bold">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <span className="text-xl">{item.icon}</span>
            </Link>
          ))}

          {/* Privacy & Policies */}
          <Link
            to="/provider/account/$section"
            params={{ section: "privacy" }}
            className="w-full mohemah-card p-4 flex items-center gap-3"
          >
            <ChevronLeft className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="flex-1 text-right">
              <p className="text-sm font-bold">السياسات والخصوصية</p>
              <p className="text-xs text-muted-foreground">شروط الاستخدام وسياسة الخصوصية</p>
            </div>
            <Shield className="w-5 h-5 text-mohemah-blue" />
          </Link>
        </div>

        {/* Experience letter (special bottom link) */}
        <Link
          to="/provider/account/$section"
          params={{ section: "experience-letter" }}
          className="block mt-4 rounded-2xl p-4 bg-gradient-to-l from-mohemah-coral to-mohemah-blue text-primary-foreground active:scale-[0.99] transition-transform"
        >
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6" />
            <div className="flex-1 text-right">
              <p className="text-sm font-bold">طباعة خطاب خبرة من تطبيق مهمة</p>
              <p className="text-[11px] opacity-90">رابط خاص لإصدار خطاب رسمي بسابقة أعمالك</p>
            </div>
          </div>
        </Link>

        <button onClick={logout} className="w-full mohemah-card p-4 mt-4 flex items-center justify-center gap-2 text-destructive font-bold">
          <LogOut className="w-5 h-5" />
          تسجيل خروج
        </button>
      </div>
    </div>
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
