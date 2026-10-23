import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function ServiceDemandChart({ data }: { data: { name: string; count: number }[] }) {
  if (!data.some(item => item.count > 0)) return <div className="h-16 sm:h-24 flex items-center justify-center text-xs text-muted-foreground">لا توجد طلبات مسجلة</div>;
  return <div className="h-44 w-full min-w-0 overflow-hidden" dir="ltr" role="img" aria-label="عدد الطلبات حسب الخدمة">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart layout="vertical" data={data.filter(item => item.count > 0).sort((a, b) => b.count - a.count).slice(0, 5)} margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
        <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 4" />
        <XAxis type="number" allowDecimals={false} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" width={88} tickFormatter={value => String(value).length > 13 ? `${String(value).slice(0, 12)}…` : String(value)} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} />
        <Tooltip cursor={{ fill: "var(--muted)" }} content={({ active, payload }) => active && payload?.length ? <div className="rounded-lg border border-border bg-card p-2 text-xs text-foreground" dir="rtl">{payload[0].payload.name}: {payload[0].value} طلب</div> : null} />
        <Bar dataKey="count" fill="var(--primary)" radius={[0, 3, 3, 0]} maxBarSize={16} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  </div>;
}

export function ActivityTrendChart({ data }: { data: { date: string; orders: number; coins: number }[] }) {
  if (!data.some(item => item.orders > 0)) return <div className="h-16 sm:h-24 flex items-center justify-center text-xs text-muted-foreground">لا توجد عمليات خلال هذه الفترة</div>;
  return <div className="h-44 w-full min-w-0 overflow-hidden" dir="ltr" role="img" aria-label="تطور الطلبات خلال الفترة المحددة">
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
        <XAxis dataKey="date" tickFormatter={value => new Date(`${value}T12:00:00`).toLocaleDateString("ar-SA-u-nu-latn", { month: "short", day: "numeric", calendar: "gregory" })} minTickGap={32} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis width={32} allowDecimals={false} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} />
        <Tooltip content={({ active, payload }) => active && payload?.length ? <div className="rounded-lg border border-border bg-card p-2 text-xs text-foreground" dir="rtl"><p>{payload[0].payload.date}</p><p>{payload[0].payload.orders} طلب · {payload[0].payload.coins} كوين</p></div> : null} />
        <Line type="monotone" dataKey="orders" stroke="var(--primary)" strokeWidth={2} dot={data.length === 1 ? { r: 3 } : false} activeDot={{ r: 4 }} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  </div>;
}