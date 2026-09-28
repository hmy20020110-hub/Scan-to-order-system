import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { BarChart3, CircleDollarSign, ClipboardList, RefreshCw, ShoppingBag } from "lucide-react";
import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Range = 7 | 30 | 90;
const money = (cents: number) => `¥${(cents / 100).toFixed(2)}`;
const palette = ["#d66a4b", "#4f8371", "#77659d", "#d2a34e"];

function Metric({ label, value, hint, icon: Icon }: { label: string; value: string; hint: string; icon: typeof BarChart3 }) {
  return (
    <div className="rounded-3xl border border-[#e1e3db] bg-[#fffefa] p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm text-[#7d887f]">{label}</div>
          <div className="mt-2 text-2xl font-extrabold tracking-tight text-[#1d2926]">{value}</div>
          <div className="mt-1 text-xs text-[#9aa39b]">{hint}</div>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#f5e9df] text-[#b95439]"><Icon className="h-5 w-5" /></div>
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-[#e1e3db] bg-[#fffefa] p-5 shadow-sm sm:p-7">
      <div className="mb-5">
        <h2 className="font-bold text-[#1d2926]">{title}</h2>
        <p className="mt-1 text-sm text-[#7d887f]">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

export default function SalesAnalytics() {
  const [days, setDays] = useState<Range>(30);
  const query = trpc.admin.salesAnalytics.useQuery({ days }, { refetchInterval: 30_000 });
  const data = query.data;
  const hasOrders = Boolean(data?.totalOrders);

  return (
    <div>
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <div className="mono text-[10px] uppercase tracking-[.22em] text-[#d66a4b]">SALES INTELLIGENCE</div>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[#1d2926]">销售数据</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#738078]">从真实订单聚合销售额、订单量、支付方式和热销菜品。页面每 30 秒刷新一次，不生成演示数据。</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-[#d7d8cf] bg-white p-1">
            {([7, 30, 90] as const).map(value => (
              <button key={value} type="button" onClick={() => setDays(value)} className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${days === value ? "bg-[#1d2926] text-white" : "text-[#728078] hover:bg-[#f2f3ed]"}`}>
                {value} 天
              </button>
            ))}
          </div>
          <Button type="button" variant="outline" onClick={() => query.refetch()} disabled={query.isFetching} className="border-[#d7d8cf] bg-white text-[#1d2926]" aria-label="刷新销售数据">
            <RefreshCw className={`h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {query.isLoading ? (
        <div className="mt-8 rounded-3xl border border-[#e1e3db] bg-[#fffefa] p-12 text-center text-sm text-[#7d887f]">正在读取真实销售数据…</div>
      ) : query.error ? (
        <div className="mt-8 rounded-3xl border border-[#f0c9c3] bg-[#fff8f6] p-8 text-center text-sm text-[#9c655d]">销售数据暂时无法读取：{query.error.message}</div>
      ) : data ? (
        <>
          <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="有效销售额" value={money(data.totalRevenueCents)} hint={`最近 ${data.days} 天，已排除取消订单`} icon={CircleDollarSign} />
            <Metric label="订单数" value={String(data.totalOrders)} hint="按订单创建时间统计" icon={ClipboardList} />
            <Metric label="客单价" value={money(data.averageOrderCents)} hint="销售额 ÷ 有效订单数" icon={BarChart3} />
            <Metric label="已支付销售额" value={money(data.paidRevenueCents)} hint="支付状态为已支付" icon={ShoppingBag} />
          </div>

          {!hasOrders && (
            <div className="mt-7 rounded-3xl border border-dashed border-[#cfd5cb] bg-[#fbfcf8] p-8 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#e7efe9] text-[#4f8371]"><BarChart3 className="h-6 w-6" /></div>
              <h2 className="mt-4 font-bold text-[#1d2926]">这段时间还没有真实订单</h2>
              <p className="mt-2 text-sm text-[#7d887f]">顾客扫码下单后，销售图表会自动填充，不会使用模拟数据。</p>
            </div>
          )}

          <div className="mt-7 grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
            <ChartCard title="销售额趋势" subtitle={`按 UTC 日期汇总最近 ${data.days} 天的有效订单`}>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs><linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#d66a4b" stopOpacity={0.28} /><stop offset="95%" stopColor="#d66a4b" stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid stroke="#ecece5" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#89948d" }} tickFormatter={value => value.slice(5)} minTickGap={26} />
                    <YAxis tick={{ fontSize: 11, fill: "#89948d" }} tickFormatter={value => `¥${(value / 100).toFixed(0)}`} width={48} />
                    <Tooltip formatter={(value: number) => [money(value), "销售额"]} labelFormatter={label => `日期 ${label}`} />
                    <Area type="monotone" dataKey="revenueCents" stroke="#d66a4b" strokeWidth={2.5} fill="url(#salesFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
            <ChartCard title="支付方式" subtitle="有效订单金额分布">
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.paymentMethods} dataKey="revenueCents" nameKey="method" innerRadius={58} outerRadius={92} paddingAngle={4}>
                      {data.paymentMethods.map((entry, index) => <Cell key={entry.method} fill={palette[index % palette.length]} />)}
                    </Pie>
                    <Tooltip formatter={(value: number) => [money(value), "销售额"]} />
                    <Legend verticalAlign="bottom" height={30} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
            <ChartCard title="每日订单量" subtitle="帮助判断营业高峰和订单波动">
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="#ecece5" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#89948d" }} tickFormatter={value => value.slice(5)} minTickGap={26} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#89948d" }} width={28} />
                    <Tooltip formatter={(value: number) => [value, "订单数"]} />
                    <Bar dataKey="orders" fill="#4f8371" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
            <ChartCard title="热销菜品" subtitle="按订单明细快照统计，最多展示 8 项">
              <div className="space-y-3">
                {data.topDishes.length === 0 ? <p className="py-16 text-center text-sm text-[#9aa39b]">暂无菜品销售记录</p> : data.topDishes.map((dish, index) => <div key={dish.dishName} className="flex items-center gap-3"><div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#f4e9df] text-sm font-bold text-[#b95439]">{index + 1}</div><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-[#35443d]">{dish.dishName}</div><div className="mt-1 text-xs text-[#89948d]">售出 {dish.quantity} 份</div></div><div className="font-bold text-[#b95439]">{money(dish.revenueCents)}</div></div>)}
              </div>
            </ChartCard>
          </div>
        </>
      ) : null}
    </div>
  );
}
