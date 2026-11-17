import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft, BadgeCheck, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Clock, Coins, Download, Mail, MapPin, Menu, MessageCircle, Phone,
  Quote, ShieldCheck, Smartphone, Sparkles, Star, Users, Wrench, X, Building2, ClipboardCheck, Languages, HandCoins,
} from "lucide-react";
import { ServiceIcon } from "@/components/ServiceAppearance";
import { fileUrl } from "@/lib/api";
import { trackEvent, trackView, useSite, type SiteContent, type SiteData, type StoreLinks } from "@/lib/site";
import logoFallback from "@/assets/mohemah-logo-new.png";

const nf = (n: number) => new Intl.NumberFormat("en-US").format(n);
const img = (u: string | null | undefined) => (u ? fileUrl(u) : "");
const waLink = (n: string) => `https://wa.me/${n.replace(/[^\d]/g, "").replace(/^0/, "966")}`;

/* ---------- Layout shared by the home page and the extra pages ---------- */
export function SiteShell({ data, children, home = false }: { data: SiteData; children: ReactNode; home?: boolean }) {
  const { content: c, app } = data;
  const [open, setOpen] = useState(false);
  const brand = /^#[0-9a-f]{6}$/i.test(app.primary_color ?? "") ? app.primary_color! : "#2B6CD9";
  const visible = (k: string) => c.sections.find((s) => s.key === k)?.visible !== false;
  const anchor = (id: string) => (home ? `#${id}` : `/site#${id}`);
  const links = [
    visible("about") && { href: anchor("about"), label: "عن " + app.name },
    visible("services") && { href: anchor("services"), label: "الخدمات" },
    visible("how") && { href: anchor("how"), label: "كيف تعمل" },
    visible("subscription") && c.subscription.show && { href: anchor("subscription"), label: "الاشتراك" },
    visible("faq") && c.faqs.length > 0 && { href: anchor("faq"), label: "الأسئلة الشائعة" },
    visible("contact") && { href: anchor("contact"), label: "تواصل معنا" },
  ].filter(Boolean) as { href: string; label: string }[];
  const navPages = data.pages.filter((p) => p.show_in_nav);
  const logo = img(app.logo_url) || logoFallback;
  const style = { "--sb": brand, "--sb-soft": `color-mix(in srgb, ${brand} 9%, white)`, "--sb-dark": `color-mix(in srgb, ${brand} 78%, black)` } as CSSProperties;

  return (
    <div dir="rtl" style={style} className="min-h-screen bg-white text-slate-800 [font-family:Cairo,system-ui,sans-serif]">
      {c.announcement.active && c.announcement.text && (
        <a href={c.announcement.link || undefined} onClick={() => trackEvent("announcement")} className="block bg-[var(--sb-dark)] text-white text-center text-sm py-2 px-4 font-semibold">
          {c.announcement.text}{c.announcement.link && <ArrowLeft className="inline size-4 mr-1" />}
        </a>
      )}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-4">
          <Link to="/site" className="flex items-center gap-2 shrink-0">
            <img src={logo} alt={app.name} className="h-10 w-10 object-contain" />
            <span className="font-extrabold text-lg text-[var(--sb-dark)]">{app.name}</span>
          </Link>
          <nav className="hidden lg:flex items-center gap-5 text-sm font-semibold text-slate-600 mr-4">
            {links.map((l) => <a key={l.href} href={l.href} className="hover:text-[var(--sb)]">{l.label}</a>)}
            {navPages.map((p) => <Link key={p.slug} to="/site/$slug" params={{ slug: p.slug }} className="hover:text-[var(--sb)]">{p.title}</Link>)}
          </nav>
          <a href={anchor("download")} onClick={() => trackEvent("nav_download")} className="mr-auto hidden sm:inline-flex items-center gap-2 bg-[var(--sb)] text-white text-sm font-bold px-4 py-2.5 rounded-xl hover:bg-[var(--sb-dark)] transition">
            <Download className="size-4" />حمّل التطبيق
          </a>
          <button className="lg:hidden mr-auto sm:mr-0 p-2 rounded-lg hover:bg-slate-100" onClick={() => setOpen((v) => !v)} aria-label="القائمة">{open ? <X /> : <Menu />}</button>
        </div>
        {open && (
          <nav className="lg:hidden border-t border-slate-100 bg-white px-4 py-3 grid gap-1 text-sm font-semibold">
            {links.map((l) => <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="py-2.5 px-2 rounded-lg hover:bg-[var(--sb-soft)]">{l.label}</a>)}
            {navPages.map((p) => <Link key={p.slug} to="/site/$slug" params={{ slug: p.slug }} onClick={() => setOpen(false)} className="py-2.5 px-2 rounded-lg hover:bg-[var(--sb-soft)]">{p.title}</Link>)}
            <a href={anchor("download")} onClick={() => setOpen(false)} className="mt-1 text-center bg-[var(--sb)] text-white py-2.5 rounded-xl">حمّل التطبيق</a>
          </nav>
        )}
      </header>

      {children}

      <footer className="bg-slate-900 text-slate-300 mt-10">
        <div className="max-w-6xl mx-auto px-4 py-10 grid gap-8 md:grid-cols-4 text-sm">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-3"><img src={logo} alt="" className="h-9 w-9 object-contain bg-white rounded-lg p-1" /><b className="text-white text-base">{app.name}</b></div>
            <p className="leading-7 max-w-md">{c.footer.text}</p>
            <div className="flex flex-wrap gap-2 mt-4">
              {(Object.entries(c.social) as [string, string][]).filter(([, v]) => v).map(([k, v]) => (
                <a key={k} href={v} target="_blank" rel="noreferrer" onClick={() => trackEvent(`social_${k}`)} className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold uppercase" dir="ltr">{k === "x" ? "X" : k}</a>
              ))}
            </div>
          </div>
          <div>
            <b className="text-white block mb-3">روابط</b>
            <ul className="grid gap-2">
              {links.slice(0, 5).map((l) => <li key={l.href}><a href={l.href} className="hover:text-white">{l.label}</a></li>)}
              {data.pages.filter((p) => p.show_in_footer).map((p) => <li key={p.slug}><Link to="/site/$slug" params={{ slug: p.slug }} className="hover:text-white">{p.title}</Link></li>)}
            </ul>
          </div>
          <div>
            <b className="text-white block mb-3">السياسات والتواصل</b>
            <ul className="grid gap-2">
              {data.policies.map((p) => <li key={p.id}><Link to="/site/$slug" params={{ slug: `policy-${p.id}` }} className="hover:text-white">{p.title}</Link></li>)}
              {(c.contact.phone || app.support_phone) && <li dir="ltr" className="text-right"><a href={`tel:${c.contact.phone || app.support_phone}`} onClick={() => trackEvent("call")} className="hover:text-white">{c.contact.phone || app.support_phone}</a></li>}
              {(c.contact.email || app.support_email) && <li dir="ltr" className="text-right"><a href={`mailto:${c.contact.email || app.support_email}`} className="hover:text-white">{c.contact.email || app.support_email}</a></li>}
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10 text-center text-xs py-4 text-slate-400">© {new Date().getFullYear()} {app.name}. جميع الحقوق محفوظة.</div>
      </footer>

      {c.contact.whatsapp && (
        <a href={waLink(c.contact.whatsapp)} target="_blank" rel="noreferrer" onClick={() => trackEvent("whatsapp")} aria-label="واتساب"
          className="fixed bottom-5 left-5 z-40 size-14 rounded-full bg-emerald-500 text-white grid place-items-center shadow-lg hover:scale-105 transition">
          <MessageCircle className="size-7" />
        </a>
      )}
    </div>
  );
}

/* ---------- Small building blocks ---------- */
function SectionHead({ kicker, title, sub }: { kicker?: string; title: string; sub?: string }) {
  return (
    <div className="text-center max-w-2xl mx-auto mb-10">
      {kicker && <span className="inline-block text-xs font-bold text-[var(--sb)] bg-[var(--sb-soft)] px-3 py-1 rounded-full mb-3">{kicker}</span>}
      <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 leading-snug">{title}</h2>
      {sub && <p className="mt-3 text-slate-500 leading-7">{sub}</p>}
    </div>
  );
}

function StoreButtons({ links, app, dark = false }: { links: StoreLinks; app: "customer" | "provider"; dark?: boolean }) {
  const items = [
    links.ios && { k: "ios", label: "App Store", sub: "حمّل من", href: links.ios },
    links.android && { k: "android", label: "Google Play", sub: "حمّل من", href: links.android },
    links.other && { k: "other", label: "تحميل مباشر", sub: "رابط آخر", href: links.other },
  ].filter(Boolean) as { k: string; label: string; sub: string; href: string }[];
  if (!items.length) return <p className={`text-sm ${dark ? "text-white/80" : "text-slate-500"}`}>روابط التحميل ستتوفر قريباً.</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((x) => (
        <a key={x.k} href={x.href} target="_blank" rel="noreferrer" onClick={() => trackEvent(`download_${app}_${x.k}`)}
          className={`inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl font-bold transition ${dark ? "bg-white text-slate-900 hover:bg-slate-100" : "bg-slate-900 text-white hover:bg-slate-700"}`}>
          <Smartphone className="size-5" />
          <span className="text-right leading-tight"><span className="block text-[10px] font-normal opacity-70">{x.sub}</span><span dir="ltr" className="text-sm">{x.label}</span></span>
        </a>
      ))}
    </div>
  );
}

/** Top banners managed from the admin panel (auto-sliding). */
function Banners({ banners }: { banners: SiteContent["banners"] }) {
  const list = banners.filter((b) => b.active !== false && (b.image_url || b.title));
  const [i, setI] = useState(0);
  useEffect(() => {
    if (list.length < 2) return;
    const t = setInterval(() => setI((v) => (v + 1) % list.length), 6000);
    return () => clearInterval(t);
  }, [list.length]);
  if (!list.length) return null;
  const b = list[Math.min(i, list.length - 1)];
  const inner = (
    <div className="relative w-full overflow-hidden rounded-3xl bg-gradient-to-l from-[var(--sb-dark)] to-[var(--sb)] text-white" style={{ aspectRatio: "3 / 1", minHeight: 150 }}>
      {b.image_url && <img src={img(b.image_url)} alt={b.title} className="absolute inset-0 w-full h-full object-cover" />}
      {(b.title || b.subtitle) && (
        <div className={`absolute inset-0 flex flex-col justify-center px-6 sm:px-12 ${b.image_url ? "bg-gradient-to-l from-black/60 via-black/25 to-transparent" : ""}`}>
          {b.title && <h3 className="text-lg sm:text-3xl font-extrabold max-w-xl leading-snug">{b.title}</h3>}
          {b.subtitle && <p className="mt-1 sm:mt-2 text-xs sm:text-base text-white/90 max-w-lg">{b.subtitle}</p>}
          {b.cta && <span className="mt-3 inline-flex w-fit items-center gap-1 bg-white text-slate-900 text-xs sm:text-sm font-bold px-4 py-2 rounded-xl">{b.cta}<ArrowLeft className="size-4" /></span>}
        </div>
      )}
    </div>
  );
  return (
    <div className="max-w-6xl mx-auto px-4 pt-6">
      <div className="relative">
        {b.link ? <a href={b.link} onClick={() => trackEvent("banner_click")}>{inner}</a> : inner}
        {list.length > 1 && (
          <>
            <button aria-label="السابق" onClick={() => setI((v) => (v - 1 + list.length) % list.length)} className="absolute right-2 top-1/2 -translate-y-1/2 size-9 rounded-full bg-white/85 grid place-items-center shadow"><ChevronRight className="size-5" /></button>
            <button aria-label="التالي" onClick={() => setI((v) => (v + 1) % list.length)} className="absolute left-2 top-1/2 -translate-y-1/2 size-9 rounded-full bg-white/85 grid place-items-center shadow"><ChevronLeft className="size-5" /></button>
            <div className="absolute bottom-3 inset-x-0 flex justify-center gap-1.5">{list.map((_, k) => <span key={k} className={`h-1.5 rounded-full transition-all ${k === i ? "w-6 bg-white" : "w-1.5 bg-white/60"}`} />)}</div>
          </>
        )}
      </div>
    </div>
  );
}

const FEATURE_ICONS = [HandCoins, ShieldCheck, Languages, BadgeCheck, Sparkles, Clock, Users, Wrench];
const STAT_ICONS: Record<string, typeof Users> = { providers: BadgeCheck, customers: Users, orders: ClipboardCheck, services: Wrench, cities: Building2, rating: Star, manual: Sparkles };

/* ---------- Home page ---------- */
export function SiteHomePage() {
  const { data, error } = useSite();
  useEffect(() => { trackView("/site"); }, []);
  useEffect(() => {
    if (!data) return;
    document.title = data.content.seo.title;
    const set = (name: string, content: string) => { let m = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`); if (!m) { m = document.createElement("meta"); m.name = name; document.head.appendChild(m); } m.content = content; };
    set("description", data.content.seo.description);
    set("keywords", data.content.seo.keywords);
    if (window.location.hash) setTimeout(() => document.querySelector(window.location.hash)?.scrollIntoView(), 50);
  }, [data]);
  if (error) return <div dir="rtl" className="min-h-screen grid place-items-center text-slate-500">تعذر تحميل الموقع، حدّث الصفحة.</div>;
  if (!data) return <div className="min-h-screen grid place-items-center"><div className="size-10 rounded-full border-4 border-slate-200 border-t-slate-500 animate-spin" /></div>;
  const { content: c, app, numbers } = data;

  const sections: Record<string, ReactNode> = {
    stats: c.stats.length > 0 && (
      <section key="stats" className="max-w-6xl mx-auto px-4 -mt-2">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {c.stats.map((s, i) => {
            const Icon = STAT_ICONS[s.source] ?? Sparkles;
            const value = s.source === "manual" ? s.value : s.source === "rating" ? (numbers.rating ? `${numbers.rating} / 5` : "—") : `+${nf(numbers[s.source] ?? 0)}`;
            return (
              <div key={i} className="rounded-2xl border border-slate-100 bg-white p-4 sm:p-5 shadow-[0_6px_24px_rgba(15,23,42,.05)] flex items-center gap-3">
                <span className="size-11 rounded-xl bg-[var(--sb-soft)] text-[var(--sb)] grid place-items-center shrink-0"><Icon className="size-5" /></span>
                <div><div className="text-xl sm:text-2xl font-extrabold text-slate-900" dir="ltr">{value}</div><div className="text-xs sm:text-sm text-slate-500">{s.label}</div></div>
              </div>
            );
          })}
        </div>
      </section>
    ),
    about: (
      <section key="about" id="about" className="max-w-6xl mx-auto px-4 py-16 grid gap-10 lg:grid-cols-2 items-center scroll-mt-20">
        <div>
          <span className="inline-block text-xs font-bold text-[var(--sb)] bg-[var(--sb-soft)] px-3 py-1 rounded-full mb-3">من نحن</span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">{c.about.title}</h2>
          <p className="mt-4 text-slate-600 leading-8 whitespace-pre-line">{c.about.body}</p>
          <ul className="mt-5 grid sm:grid-cols-2 gap-2.5">
            {c.about.points.filter(Boolean).map((p, i) => <li key={i} className="flex items-start gap-2 text-sm font-semibold text-slate-700"><CheckCircle2 className="size-5 text-emerald-500 shrink-0" />{p}</li>)}
          </ul>
        </div>
        <div className="rounded-3xl overflow-hidden bg-gradient-to-br from-[var(--sb-soft)] to-white border border-slate-100 aspect-[4/3] grid place-items-center">
          {c.about.image_url ? <img src={img(c.about.image_url)} alt={c.about.title} className="w-full h-full object-cover" /> : <img src={img(app.logo_url) || logoFallback} alt="" className="w-40 h-40 object-contain opacity-90" />}
        </div>
      </section>
    ),
    services: data.services.length > 0 && (
      <section key="services" id="services" className="bg-slate-50 py-16 scroll-mt-16">
        <div className="max-w-6xl mx-auto px-4">
          <SectionHead kicker="الخدمات" title={c.services.title} sub={c.services.subtitle} />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {data.services.slice(0, c.services.limit || 12).map((s) => (
              <div key={s.id} className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-5 hover:shadow-lg hover:-translate-y-0.5 transition">
                <ServiceIcon icon={s.icon} color={s.color} className="size-12" />
                <h3 className="mt-3 font-extrabold text-slate-900">{s.name}</h3>
                {s.description && <p className="mt-1 text-xs text-slate-500 leading-6 line-clamp-2">{s.description}</p>}
                {s.tasks > 0 && <p className="mt-2 text-[11px] font-bold text-[var(--sb)]">{s.tasks} مهمة متاحة</p>}
              </div>
            ))}
          </div>
          {data.services.length > (c.services.limit || 12) && <p className="text-center text-sm text-slate-500 mt-6">و{data.services.length - (c.services.limit || 12)} تصنيفات أخرى داخل التطبيق.</p>}
        </div>
      </section>
    ),
    how: <HowItWorks key="how" c={c} />,
    features: c.features.length > 0 && (
      <section key="features" className="bg-slate-50 py-16">
        <div className="max-w-6xl mx-auto px-4">
          <SectionHead kicker="لماذا نحن" title={`لماذا ${app.name}؟`} />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {c.features.map((f, i) => {
              const Icon = FEATURE_ICONS[i % FEATURE_ICONS.length];
              return (
                <div key={i} className="bg-white rounded-2xl border border-slate-100 p-5">
                  <span className="size-11 rounded-xl bg-[var(--sb)] text-white grid place-items-center"><Icon className="size-5" /></span>
                  <h3 className="mt-3 font-extrabold text-slate-900">{f.title}</h3>
                  <p className="mt-1.5 text-sm text-slate-500 leading-7">{f.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    ),
    subscription: c.subscription.show && (app.billing.subscription || app.billing.coins) && (
      <section key="subscription" id="subscription" className="max-w-6xl mx-auto px-4 py-16 scroll-mt-16">
        <SectionHead kicker="لمقدمي الخدمة" title={c.subscription.title} sub={c.subscription.subtitle} />
        <div className={app.billing.coins && app.billing.subscription && app.billing.plans.length > 0 ? "grid gap-4 lg:grid-cols-3" : "grid gap-4 max-w-xl mx-auto"}>
          {app.billing.coins && (
            <div className="rounded-3xl border border-slate-200 p-6 bg-white">
              <span className="size-11 rounded-xl bg-amber-100 text-amber-600 grid place-items-center"><Coins className="size-5" /></span>
              <h3 className="mt-3 text-lg font-extrabold">الدفع بالكوينز</h3>
              <p className="text-sm text-slate-500 mt-1 leading-7">اشحن رصيدك وادفع فقط عن الطلب الذي تقبله. مناسب لمن يبدأ أو يعمل بدوام جزئي.</p>
              <div className="mt-4 text-3xl font-extrabold text-slate-900" dir="ltr">{app.billing.coin_price} <span className="text-base font-bold text-slate-500">ريال / {app.currency_label}</span></div>
              <ul className="mt-4 grid gap-2 text-sm text-slate-600">
                <li className="flex gap-2"><CheckCircle2 className="size-5 text-emerald-500 shrink-0" />بدون التزام شهري</li>
                <li className="flex gap-2"><CheckCircle2 className="size-5 text-emerald-500 shrink-0" />تكلفة كل خدمة تظهر قبل القبول</li>
              </ul>
            </div>
          )}
          {app.billing.subscription && app.billing.plans.length > 0 && (
            <div className={`rounded-3xl p-6 bg-gradient-to-br from-[var(--sb)] to-[var(--sb-dark)] text-white ${app.billing.coins ? "lg:col-span-2" : "lg:col-span-3"}`}>
              <div className="flex items-center gap-3"><span className="size-11 rounded-xl bg-white/15 grid place-items-center"><ShieldCheck className="size-5" /></span><div><h3 className="text-lg font-extrabold">الاشتراك</h3><p className="text-sm text-white/80">اقبل الطلبات طوال مدة اشتراكك دون خصم عن كل طلب.</p></div></div>
              <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {app.billing.plans.map((p) => {
                  const base = app.billing.plans.find((x) => x.months === 1)?.price;
                  const save = base && p.months > 1 ? Math.round((1 - p.price / (base * p.months)) * 100) : 0;
                  return (
                    <div key={p.months} className="rounded-2xl bg-white text-slate-900 p-4 text-center relative">
                      {save > 0 && <span className="absolute -top-2 right-1/2 translate-x-1/2 text-[10px] font-bold bg-emerald-500 text-white px-2 py-0.5 rounded-full whitespace-nowrap">وفّر {save}%</span>}
                      <div className="text-xs font-bold text-slate-500">{p.months === 1 ? "شهر" : p.months === 12 ? "سنة" : `${p.months} أشهر`}</div>
                      <div className="mt-1 text-2xl font-extrabold" dir="ltr">{nf(p.price)}</div>
                      <div className="text-[11px] text-slate-500">ريال</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        {c.subscription.note && <p className="text-center text-xs text-slate-400 mt-4">{c.subscription.note}{app.billing.vat_percent ? ` (الضريبة ${app.billing.vat_percent}%)` : ""}</p>}
        <div className="mt-6 flex justify-center"><StoreButtons links={app.provider} app="provider" /></div>
      </section>
    ),
    testimonials: c.testimonials.length > 0 && (
      <section key="testimonials" className="bg-slate-50 py-16">
        <div className="max-w-6xl mx-auto px-4">
          <SectionHead kicker="آراء المستخدمين" title="ماذا يقولون عنا" />
          <div className="grid md:grid-cols-3 gap-4">
            {c.testimonials.map((t, i) => (
              <figure key={i} className="bg-white rounded-2xl border border-slate-100 p-5">
                <Quote className="size-6 text-[var(--sb)] opacity-50" />
                <blockquote className="mt-2 text-sm text-slate-600 leading-7">{t.text}</blockquote>
                <div className="flex gap-0.5 mt-3">{Array.from({ length: 5 }, (_, k) => <Star key={k} className={`size-4 ${k < (t.rating || 5) ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />)}</div>
                <figcaption className="mt-2 text-sm font-extrabold text-slate-900">{t.name}{t.role && <span className="font-normal text-slate-400"> — {t.role}</span>}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>
    ),
    faq: c.faqs.length > 0 && (
      <section key="faq" id="faq" className="max-w-3xl mx-auto px-4 py-16 scroll-mt-16">
        <SectionHead kicker="مساعدة" title="الأسئلة الشائعة" />
        <div className="grid gap-3">
          {c.faqs.map((f, i) => (
            <details key={i} className="group rounded-2xl border border-slate-200 bg-white open:border-[var(--sb)] open:shadow-sm" onToggle={(e) => (e.currentTarget as HTMLDetailsElement).open && trackEvent("faq_open")}>
              <summary className="flex items-center justify-between gap-3 cursor-pointer list-none p-4 font-bold text-slate-900">{f.q}<ChevronDown className="size-5 shrink-0 text-slate-400 group-open:rotate-180 transition" /></summary>
              <p className="px-4 pb-4 text-sm text-slate-600 leading-7 whitespace-pre-line">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    ),
    download: (
      <section key="download" id="download" className="max-w-6xl mx-auto px-4 py-10 scroll-mt-16">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl p-7 bg-gradient-to-br from-[var(--sb)] to-[var(--sb-dark)] text-white">
            <span className="text-xs font-bold bg-white/15 px-3 py-1 rounded-full">لطالب الخدمة</span>
            <h3 className="mt-3 text-2xl font-extrabold">تطبيق «{app.name}»</h3>
            <p className="mt-2 text-white/85 text-sm leading-7 mb-5">اطلب أي خدمة وتابعها حتى الإنجاز، بدون أي رسوم من التطبيق.</p>
            <StoreButtons links={app.customer} app="customer" dark />
          </div>
          <div className="rounded-3xl p-7 bg-slate-900 text-white">
            <span className="text-xs font-bold bg-white/15 px-3 py-1 rounded-full">لمقدم الخدمة</span>
            <h3 className="mt-3 text-2xl font-extrabold">تطبيق «{app.name} شريك»</h3>
            <p className="mt-2 text-white/85 text-sm leading-7 mb-5">سجّل مهارتك، استقبل الطلبات في مدينتك وزد دخلك.</p>
            <StoreButtons links={app.provider} app="provider" dark />
          </div>
        </div>
      </section>
    ),
    contact: <ContactSection key="contact" data={data} />,
  };

  return (
    <SiteShell data={data} home>
      <Banners banners={c.banners} />
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(60%_60%_at_80%_0%,var(--sb-soft),transparent)]" />
        <div className="max-w-6xl mx-auto px-4 py-12 sm:py-16 grid gap-10 lg:grid-cols-2 items-center">
          <div>
            {c.hero.badge && <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--sb)] bg-[var(--sb-soft)] px-3 py-1.5 rounded-full"><Sparkles className="size-3.5" />{c.hero.badge}</span>}
            <h1 className="mt-4 text-3xl sm:text-5xl font-extrabold text-slate-900 leading-[1.25]">{c.hero.title}</h1>
            <p className="mt-4 text-slate-600 text-base sm:text-lg leading-8 max-w-xl">{c.hero.subtitle}</p>
            <div className="mt-7 grid gap-4">
              <div><p className="text-xs font-bold text-slate-500 mb-2">أحتاج خدمة — تطبيق طالب الخدمة</p><StoreButtons links={app.customer} app="customer" /></div>
              <a href="#subscription" onClick={() => trackEvent("hero_provider")} className="inline-flex w-fit items-center gap-1.5 text-sm font-bold text-[var(--sb)] hover:underline">أنا مقدم خدمة وأريد الانضمام<ArrowLeft className="size-4" /></a>
            </div>
          </div>
          <div className="relative">
            <div className="rounded-[2rem] overflow-hidden border border-slate-100 bg-gradient-to-br from-[var(--sb)] to-[var(--sb-dark)] aspect-[4/3] grid place-items-center shadow-[0_30px_80px_-20px_var(--sb)]">
              {c.hero.image_url ? <img src={img(c.hero.image_url)} alt={c.hero.title} className="w-full h-full object-cover" /> : (
                <div className="text-center text-white p-8">
                  <img src={img(app.logo_url) || logoFallback} alt="" className="mx-auto size-28 object-contain bg-white rounded-3xl p-3" />
                  <p className="mt-5 text-xl font-extrabold">{app.name}</p>
                  <p className="text-white/80 text-sm mt-1">{c.hero.badge}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
      {c.sections.filter((s) => s.visible !== false).map((s) => sections[s.key])}
    </SiteShell>
  );
}

function HowItWorks({ c }: { c: SiteContent }) {
  const [tab, setTab] = useState<"customer" | "provider">("customer");
  const block = tab === "customer" ? c.how_customer : c.how_provider;
  return (
    <section id="how" className="max-w-6xl mx-auto px-4 py-16 scroll-mt-16">
      <SectionHead kicker="الخطوات" title="كيف تعمل المنصة؟" />
      <div className="flex justify-center mb-8">
        <div className="inline-flex p-1 rounded-2xl bg-slate-100 text-sm font-bold">
          {(["customer", "provider"] as const).map((k) => (
            <button key={k} onClick={() => { setTab(k); trackEvent(`how_${k}`); }} className={`px-5 py-2.5 rounded-xl transition ${tab === k ? "bg-white shadow text-[var(--sb)]" : "text-slate-500"}`}>{k === "customer" ? c.how_customer.title : c.how_provider.title}</button>
          ))}
        </div>
      </div>
      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {block.steps.map((s, i) => (
          <li key={i} className="relative rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_6px_24px_rgba(15,23,42,.04)]">
            <span className="size-10 rounded-full bg-[var(--sb)] text-white grid place-items-center font-extrabold">{i + 1}</span>
            <h3 className="mt-3 font-extrabold text-slate-900">{s.title}</h3>
            <p className="mt-1.5 text-sm text-slate-500 leading-7">{s.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function ContactSection({ data }: { data: SiteData }) {
  const { content: c, app } = data;
  const [f, setF] = useState({ name: "", phone: "", email: "", topic: "general", message: "", website: "" });
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [err, setErr] = useState("");
  const phone = c.contact.phone || app.support_phone || "";
  const email = c.contact.email || app.support_email || "";
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(""); setState("sending");
    try {
      const r = await fetch("/api/site/contact", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(f) });
      if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { message?: string }).message ?? "تعذر الإرسال، حاول لاحقاً");
      setState("sent");
    } catch (x) { setErr(x instanceof Error ? x.message : "تعذر الإرسال"); setState("idle"); }
  };
  const input = "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[var(--sb)] focus:ring-2 focus:ring-[var(--sb-soft)]";
  return (
    <section id="contact" className="max-w-6xl mx-auto px-4 py-16 scroll-mt-16">
      <SectionHead kicker="تواصل معنا" title="يسعدنا تواصلك" sub="للاستفسارات والشراكات والملاحظات، راسلنا وسيرد عليك الفريق المختص." />
      <div className={`grid gap-6 ${c.contact.show_form ? "lg:grid-cols-5" : ""}`}>
        <div className={`grid gap-3 content-start ${c.contact.show_form ? "lg:col-span-2" : "sm:grid-cols-2 lg:grid-cols-4"}`}>
          {phone && <a href={`tel:${phone}`} onClick={() => trackEvent("call")} className="flex items-center gap-3 rounded-2xl border border-slate-100 p-4 hover:border-[var(--sb)]"><span className="size-10 rounded-xl bg-[var(--sb-soft)] text-[var(--sb)] grid place-items-center"><Phone className="size-5" /></span><div><div className="text-xs text-slate-500">اتصل بنا</div><div className="font-bold" dir="ltr">{phone}</div></div></a>}
          {c.contact.whatsapp && <a href={waLink(c.contact.whatsapp)} target="_blank" rel="noreferrer" onClick={() => trackEvent("whatsapp")} className="flex items-center gap-3 rounded-2xl border border-slate-100 p-4 hover:border-emerald-400"><span className="size-10 rounded-xl bg-emerald-50 text-emerald-600 grid place-items-center"><MessageCircle className="size-5" /></span><div><div className="text-xs text-slate-500">واتساب</div><div className="font-bold" dir="ltr">{c.contact.whatsapp}</div></div></a>}
          {email && <a href={`mailto:${email}`} onClick={() => trackEvent("email")} className="flex items-center gap-3 rounded-2xl border border-slate-100 p-4 hover:border-[var(--sb)]"><span className="size-10 rounded-xl bg-[var(--sb-soft)] text-[var(--sb)] grid place-items-center"><Mail className="size-5" /></span><div><div className="text-xs text-slate-500">البريد الإلكتروني</div><div className="font-bold" dir="ltr">{email}</div></div></a>}
          {c.contact.address && <div className="flex items-center gap-3 rounded-2xl border border-slate-100 p-4"><span className="size-10 rounded-xl bg-[var(--sb-soft)] text-[var(--sb)] grid place-items-center"><MapPin className="size-5" /></span><div><div className="text-xs text-slate-500">العنوان</div><div className="font-bold">{c.contact.address}</div></div></div>}
          {c.contact.hours && <div className="flex items-center gap-3 rounded-2xl border border-slate-100 p-4"><span className="size-10 rounded-xl bg-[var(--sb-soft)] text-[var(--sb)] grid place-items-center"><Clock className="size-5" /></span><div><div className="text-xs text-slate-500">ساعات العمل</div><div className="font-bold">{c.contact.hours}</div></div></div>}
        </div>
        {c.contact.show_form && (
          <div className="lg:col-span-3 rounded-3xl border border-slate-100 bg-slate-50 p-5 sm:p-7">
            {state === "sent" ? (
              <div className="text-center py-10"><CheckCircle2 className="size-14 text-emerald-500 mx-auto" /><h3 className="mt-3 text-lg font-extrabold">وصلتنا رسالتك</h3><p className="text-sm text-slate-500 mt-1">سيتواصل معك الفريق المختص قريباً.</p></div>
            ) : (
              <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
                <input className={input} placeholder="الاسم" required minLength={2} maxLength={100} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
                <select className={input} value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })} aria-label="نوع الرسالة">
                  <option value="general">استفسار عام</option><option value="customer">طالب خدمة</option><option value="provider">مقدم خدمة</option><option value="partnership">شراكة أو إعلان</option><option value="complaint">ملاحظة أو شكوى</option>
                </select>
                <input className={input} placeholder="رقم الجوال" dir="ltr" inputMode="tel" maxLength={20} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
                <input className={input} placeholder="البريد الإلكتروني (اختياري)" dir="ltr" type="email" maxLength={150} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
                <input className="hidden" tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} aria-hidden />
                <textarea className={`${input} sm:col-span-2 min-h-32`} placeholder="رسالتك" required minLength={5} maxLength={2000} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} />
                {err && <p className="sm:col-span-2 text-sm text-red-600">{err}</p>}
                <button disabled={state === "sending"} className="sm:col-span-2 bg-[var(--sb)] hover:bg-[var(--sb-dark)] text-white font-bold py-3 rounded-xl disabled:opacity-60">{state === "sending" ? "جارٍ الإرسال…" : "إرسال الرسالة"}</button>
              </form>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/* ---------- Extra pages and policies: /site/<slug> ---------- */
export function SiteDocPage({ slug }: { slug: string }) {
  const { data } = useSite();
  const [page, setPage] = useState<{ title: string; body: string; updated_at: string | null } | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    setPage(null); setMissing(false);
    trackView(`/site/${slug}`);
    fetch(`/api/site/pages/${encodeURIComponent(slug)}`).then((r) => (r.ok ? r.json() : Promise.reject())).then((p) => { setPage(p as typeof page); }).catch(() => setMissing(true));
    window.scrollTo(0, 0);
  }, [slug]);
  useEffect(() => { if (page && data) document.title = `${page.title} — ${data.app.name}`; }, [page, data]);
  if (!data) return <div className="min-h-screen grid place-items-center"><div className="size-10 rounded-full border-4 border-slate-200 border-t-slate-500 animate-spin" /></div>;
  return (
    <SiteShell data={data}>
      <main className="max-w-3xl mx-auto px-4 py-12 min-h-[50vh]">
        {missing ? (
          <div className="text-center py-16"><h1 className="text-2xl font-extrabold">الصفحة غير موجودة</h1><Link to="/site" className="inline-block mt-4 text-[var(--sb)] font-bold">العودة للرئيسية</Link></div>
        ) : !page ? <div className="h-40 rounded-2xl bg-slate-100 animate-pulse" /> : (
          <article>
            <h1 className="text-3xl font-extrabold text-slate-900">{page.title}</h1>
            {page.updated_at && <p className="text-xs text-slate-400 mt-2">آخر تحديث: {new Date(page.updated_at).toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", { dateStyle: "long" })}</p>}
            <div className="mt-6 grid gap-3 text-slate-700 leading-8">
              {page.body.split(/\n+/).map((line, i) => line.startsWith("## ") ? <h3 key={i} className="text-lg font-extrabold text-slate-900 mt-3">{line.slice(3)}</h3>
                : line.startsWith("# ") ? <h2 key={i} className="text-xl font-extrabold text-slate-900 mt-4">{line.slice(2)}</h2>
                : line.startsWith("- ") ? <p key={i} className="flex gap-2"><span className="mt-3 size-1.5 rounded-full bg-[var(--sb)] shrink-0" />{line.slice(2)}</p>
                : <p key={i}>{line}</p>)}
            </div>
          </article>
        )}
      </main>
    </SiteShell>
  );
}
