import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Download, Info, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePublicData } from "@/lib/publicData";
import { fileUrl } from "@/lib/api";
import logo from "@/assets/mohemah-logo-new.png";
import guideCustomer from "@/assets/guide-customer.jpg";
import guideProvider from "@/assets/guide-provider.jpg";

export function AppOpening() {
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const { settings } = usePublicData();
  const [broken, setBroken] = useState(false);
  const image = settings?.logo_url && !broken ? fileUrl(settings.logo_url) : logo;
  const name = settings?.app_name ?? "مهمة";
  useEffect(() => {
    const timer = window.setTimeout(() => setLeaving(true), window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 500 : 1600);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => setVisible(false), 280);
    return () => window.clearTimeout(timer);
  }, [leaving]);
  if (!visible) return null;
  return <div className={`app-opening fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center gap-5 ${leaving ? "app-opening-leaving" : ""}`} role="dialog" aria-label={`مرحباً بك في ${name}`} aria-modal="true" dir="rtl">
    <div className="app-opening-mark"><img src={image} onError={() => setBroken(true)} alt={`شعار ${name}`} className="app-opening-logo size-28 sm:size-32 object-contain" /></div>
    <p className="app-opening-name text-2xl font-bold">{name}</p>
    <div className="app-opening-progress h-0.5 w-20 overflow-hidden bg-border rounded-full" aria-hidden="true"><span className="block h-full bg-primary" /></div>
    <Button variant="ghost" size="sm" onClick={() => setLeaving(true)}>متابعة <ArrowLeft /></Button>
  </div>;
}

export function AppGuideLink() {
  return <Button variant="ghost" size="sm" asChild><Link to="/about"><Info />عن مهمة وطريقة العمل</Link></Button>;
}

function GuideSection({ title, image, alt, steps, note }: { title: string; image: string; alt: string; steps: string[]; note?: string }) {
  return <section className="mohemah-card overflow-hidden">
    <img src={image} alt={alt} loading="lazy" width={1088} height={608} className="aspect-[16/9] w-full object-cover" />
    <div className="space-y-3 p-4">
      <h2 className="text-lg font-bold">{title}</h2>
      <ol className="space-y-2">
        {steps.map((s, i) => <li key={i} className="flex items-start gap-3 text-sm leading-6"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{i + 1}</span><span>{s}</span></li>)}
      </ol>
      {note && <p className="rounded-lg bg-accent px-3 py-2 text-sm font-bold text-primary">{note}</p>}
    </div>
  </section>;
}

export function AppGuide() {
  return <main className="max-w-2xl mx-auto px-4 py-6 pb-28 space-y-5" dir="rtl">
    <Button variant="ghost" asChild><Link to="/account">حسابي <ArrowLeft /></Link></Button>
    <div className="flex items-center gap-3"><img src={logo} alt="مهمة" className="size-14 object-contain" /><h1 className="text-xl font-bold">عن مهمة وطريقة العمل</h1></div>
    <GuideSection title="طالب الخدمة" image={guideCustomer} alt="طالب خدمة يختار خدمة من الجوال ثم يصل الفني"
      steps={["اختر الخدمة الرئيسية ثم الخدمة الفرعية، وحدد حضوريًا أو عن بُعد حسب المتاح.", "أرسل تفاصيل طلبك وموقعك أو موعدك، ثم تابع قبول مقدم الخدمة.", "تواصل مع مقدم الخدمة وتابع تنفيذ الطلب حتى اكتماله."]}
      note="لا يأخذ التطبيق أي رسوم من طالب الخدمة." />
    <GuideSection title="مقدم الخدمة" image={guideProvider} alt="مقدم خدمة يستقبل الطلبات ويقبلها بالكوينز أو الاشتراك"
      steps={["حدد الخدمات التي تقدمها لتظهر لك الطلبات المرتبطة بها.", "اختر الكوينز لكل طلب أو الاشتراك من الطرق المفعّلة في الإدارة.", "مع الاشتراك الفعّال تُقبل الطلبات بلا خصم، وبدونه تحتاج رصيد كوينز يكفي الطلب.", "تابع الرسائل ونفّذ الطلب، وراجع رصيدك وتاريخ انتهاء اشتراكك."]} />
    <Button variant="outline" asChild><a href={logo} download="mohemah-logo.png"><Download />تحميل شعار مهمة</a></Button>
  </main>;
}