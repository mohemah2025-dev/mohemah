import { useState } from "react";
import { Button } from "@/components/ui/button";
import { iconGroups, iconLabels, normalizedIcon, serviceColors, serviceIcons, suggestIcons } from "@/lib/serviceAppearance";

export function ServiceIcon({ icon, color, className = "" }: { icon?: string | null; color?: string | null; className?: string }) {
  const key = normalizedIcon(icon);
  const Icon = serviceIcons[key];
  return <span data-service-color={serviceColors.some(c => c.key === color) ? color : "blue"} className={`service-icon inline-flex shrink-0 items-center justify-center rounded-lg ${className}`}>
    {Icon ? <Icon className="size-6" strokeWidth={1.6} /> : <span className="text-xl">{key}</span>}
  </span>;
}

export function AppearancePicker({ icon, color, name = "", onChange }: { icon: string; color: string; name?: string; onChange: (patch: { icon?: string; color?: string }) => void }) {
  const suggested = suggestIcons(name, 30);
  const [group, setGroup] = useState(iconGroups[0].name);
  const [search, setSearch] = useState("");
  const icons = search.trim() ? Object.keys(serviceIcons).filter(k => `${iconLabels[k]} ${k}`.toLowerCase().includes(search.toLowerCase())) : iconGroups.find(g => g.name === group)?.icons ?? [];
  return <div className="space-y-3">
    <div className="flex items-center gap-3"><ServiceIcon icon={icon} color={color} className="size-12" /><span className="text-sm font-semibold">الأيقونة واللون</span></div>
    <div>
      <p className="text-xs font-semibold mb-1.5">أيقونات مقترحة رسمية ({suggested.length}){name.trim() ? ` لـ «${name.trim()}»` : ""}</p>
      <div className="grid grid-cols-6 sm:grid-cols-10 gap-1.5">{suggested.map(k => { const Icon = serviceIcons[k]; const on = normalizedIcon(icon) === k; return <button key={k} type="button" title={iconLabels[k]} aria-label={`أيقونة ${iconLabels[k]}`} aria-pressed={on} onClick={() => onChange({ icon: k })} className={`aspect-square rounded-lg border grid place-items-center transition ${on ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}><Icon className="size-5" strokeWidth={1.6} /></button>; })}</div>
    </div>
    <div className="flex flex-wrap gap-2" role="group" aria-label="لون الخدمة">{serviceColors.map(c => <Button key={c.key} type="button" variant="ghost" size="icon" title={c.name} aria-label={`لون ${c.name}`} aria-pressed={color === c.key} onClick={() => onChange({ color: c.key })} className={`rounded-full ${color === c.key ? "ring-2 ring-ring ring-offset-2 ring-offset-background" : ""}`}><span data-service-color={c.key} className="service-swatch size-6 rounded-full" /></Button>)}</div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2"><select aria-label="مجال الأيقونات" value={group} onChange={e => { setGroup(e.target.value); setSearch(""); }} className="admin-input">{iconGroups.map(g => <option key={g.name}>{g.name}</option>)}</select><input aria-label="بحث الأيقونات" placeholder="بحث عن أيقونة" value={search} onChange={e => setSearch(e.target.value)} className="admin-input" /></div>
    <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 max-h-40 overflow-y-auto p-1">{icons.map(k => { const Icon = serviceIcons[k]; return <Button key={k} type="button" variant={normalizedIcon(icon) === k ? "default" : "outline"} size="icon" title={iconLabels[k]} aria-label={`أيقونة ${iconLabels[k]}`} aria-pressed={normalizedIcon(icon) === k} onClick={() => onChange({ icon: k })} className="w-full"><Icon /></Button>; })}</div>
    {icons.length === 0 && <p className="text-sm text-muted-foreground">لا توجد أيقونات مطابقة</p>}
    <label className="block text-xs text-muted-foreground">أيقونة مخصصة<input aria-label="أيقونة مخصصة" value={icon} onChange={e => onChange({ icon: e.target.value })} className="admin-input mt-1" /></label>
  </div>;
}