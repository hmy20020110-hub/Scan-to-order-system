import { useAuth } from "@/_core/hooks/useAuth";
import type { AdminState as BackendAdminState } from "../../../server/db";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { TABLE_CODE_PATTERN, validateTableInput } from "@shared/table-validation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import * as QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { BarChart3, Check, ClipboardList, Copy, ExternalLink, LayoutDashboard, LogOut, Menu as MenuIcon, Plus, QrCode, Settings, Store, Table2, UtensilsCrossed } from "lucide-react";

const money = (cents: number) => `¥${(cents / 100).toFixed(2)}`;
const dateTime = (value: Date | string) => new Date(value).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
const orderStatus: Record<string, { label: string; className: string }> = {
  pending: { label: "待确认", className: "bg-[#fff0db] text-[#9d6420]" },
  confirmed: { label: "已确认", className: "bg-[#e5f0eb] text-[#39705d]" },
  preparing: { label: "制作中", className: "bg-[#e7eff4] text-[#3b6476]" },
  ready: { label: "待取餐", className: "bg-[#eee8f7] text-[#68508b]" },
  served: { label: "已完成", className: "bg-[#e9ece8] text-[#68736c]" },
  cancelled: { label: "已取消", className: "bg-[#fbe4e2] text-[#a64b43]" },
};
const nextStatuses = ["pending", "confirmed", "preparing", "ready", "served", "cancelled"] as const;
type Tab = "overview" | "menu" | "tables" | "orders" | "settings";

export default function AdminDashboard() {
  const { user, loading, logout } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");
  const stateQuery = trpc.admin.state.useQuery(undefined, { enabled: user?.role === "admin", retry: false });
  const state = stateQuery.data;

  if (loading) return <LoadingScreen />;
  if (!user) return <LoginScreen />;
  if (user.role !== "admin") return <ForbiddenScreen onLogout={logout} />;
  if (stateQuery.isLoading) return <LoadingScreen label="正在连接门店数据…" />;
  if (stateQuery.error) return <ErrorScreen message={stateQuery.error.message} onRetry={() => stateQuery.refetch()} />;
  if (!state) return <Onboarding onCreated={() => stateQuery.refetch()} />;

  const nav = [
    { id: "overview" as const, label: "经营概览", icon: LayoutDashboard },
    { id: "menu" as const, label: "菜单管理", icon: MenuIcon },
    { id: "tables" as const, label: "桌台与二维码", icon: QrCode },
    { id: "orders" as const, label: "订单处理", icon: ClipboardList },
    { id: "settings" as const, label: "门店设置", icon: Settings },
  ];

  return <div className="min-h-screen bg-[#f7f6f1] text-[#1d2926]"><aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-[#1d2926] text-[#f7f6f1] lg:flex"><div className="flex items-center gap-3 border-b border-[#3b4d46] px-6 py-5"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#d66a4b] text-white"><UtensilsCrossed className="h-5 w-5" /></div><div><div className="font-bold tracking-tight">桌边 / ORDER</div><div className="mono text-[10px] uppercase tracking-[.2em] text-[#a8b5ac]">merchant console</div></div></div><div className="px-4 pt-7"><div className="px-3 text-[10px] uppercase tracking-[.22em] text-[#82938a]">管理工作台</div><nav className="mt-3 space-y-1">{nav.map(item => <button key={item.id} onClick={() => setTab(item.id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition-colors ${tab === item.id ? "bg-[#30443d] font-semibold text-white" : "text-[#b7c3bb] hover:bg-[#263a34] hover:text-white"}`}><item.icon className={`h-4 w-4 ${tab === item.id ? "text-[#e58a69]" : ""}`} />{item.label}</button>)}</nav></div><div className="mt-auto border-t border-[#3b4d46] p-4"><div className="mb-3 flex items-center gap-3 px-2"><div className="grid h-9 w-9 place-items-center rounded-full bg-[#d6a38d] font-bold text-[#5e2d22]">{(user.name || "店").slice(0, 1)}</div><div className="min-w-0"><div className="truncate text-sm font-semibold">{user.name || "门店管理员"}</div><div className="truncate text-xs text-[#9aa9a0]">{user.email || "已登录"}</div></div></div><button onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-[#b7c3bb] hover:bg-[#263a34] hover:text-white"><LogOut className="h-4 w-4" />退出登录</button></div></aside><div className="lg:pl-64"><header className="sticky top-0 z-30 border-b border-[#e3e4dc] bg-[#f7f6f1]/95 backdrop-blur"><div className="container flex items-center justify-between py-4"><div><div className="flex items-center gap-2 text-sm text-[#7d887f]"><Store className="h-4 w-4" />商家后台</div><h1 className="mt-1 text-xl font-bold tracking-tight">{state.restaurant.name}</h1></div><div className="flex items-center gap-2"><Link href="/"><Button variant="outline" className="hidden border-[#d2d5cd] bg-white text-[#1d2926] sm:flex"><ExternalLink className="mr-2 h-4 w-4" />查看首页</Button></Link><button onClick={logout} className="grid h-10 w-10 place-items-center rounded-xl border border-[#d2d5cd] bg-white text-[#6f7b73] hover:bg-[#fff3eb] lg:hidden" aria-label="退出登录"><LogOut className="h-4 w-4" /></button></div></div><div className="container flex gap-1 overflow-x-auto pb-3 lg:hidden">{nav.map(item => <button key={item.id} onClick={() => setTab(item.id)} className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold ${tab === item.id ? "bg-[#1d2926] text-white" : "bg-white text-[#748078]"}`}><item.icon className="h-3.5 w-3.5" />{item.label}</button>)}</div></header><main className="container py-7 lg:py-10">{tab === "overview" && <Overview state={state} onGo={setTab} />}{tab === "menu" && <MenuManager state={state} onRefresh={() => stateQuery.refetch()} />}{tab === "tables" && <TableManager state={state} onRefresh={() => stateQuery.refetch()} />}{tab === "orders" && <OrderManager state={state} onRefresh={() => stateQuery.refetch()} />}{tab === "settings" && <SettingsManager state={state} onSaved={() => stateQuery.refetch()} />}</main></div></div>;
}

function LoadingScreen({ label = "正在加载…" }: { label?: string }) { return <div className="grid min-h-screen place-items-center bg-[#f7f6f1] text-[#68736d]"><div className="text-center"><div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-4 border-[#ead5c8] border-t-[#d66a4b]" /><p>{label}</p></div></div>; }
function LoginScreen() { return <div className="grid min-h-screen place-items-center bg-[#1d2926] p-5"><div className="w-full max-w-md rounded-[2rem] bg-[#f7f6f1] p-8 text-center sm:p-10"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#d66a4b] text-white"><UtensilsCrossed className="h-7 w-7" /></div><div className="mono mt-7 text-[10px] uppercase tracking-[.25em] text-[#d66a4b]">MERCHANT CONSOLE</div><h1 className="mt-2 text-3xl font-extrabold tracking-tight">登录管理后台</h1><p className="mt-3 leading-6 text-[#738078]">只有门店管理员可以查看和处理订单。顾客无需登录即可通过桌台二维码点餐。</p><Button onClick={() => startLogin()} className="mt-7 h-12 w-full rounded-xl bg-[#1d2926] text-white hover:bg-[#304640]">安全登录</Button><Link href="/"><Button variant="ghost" className="mt-2 text-[#748078]">返回首页</Button></Link></div></div>; }
function ForbiddenScreen({ onLogout }: { onLogout: () => void }) { return <div className="grid min-h-screen place-items-center bg-[#f7f6f1] p-6 text-center"><div><ShieldIcon /><h1 className="mt-5 text-2xl font-bold">当前账号没有管理权限</h1><p className="mt-2 text-[#738078]">请使用门店管理员账号登录，或联系系统所有者开通权限。</p><Button onClick={onLogout} variant="outline" className="mt-6">退出当前账号</Button></div></div>; }
function ShieldIcon() { return <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-[#fbe8dc] text-[#b95439]"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3 4.5 6v5.5c0 4.7 3.2 8 7.5 9.5 4.3-1.5 7.5-4.8 7.5-9.5V6z"/><path d="m9 12 2 2 4-4"/></svg></div>; }
function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) { return <div className="mx-auto max-w-xl rounded-3xl border border-[#f0c9c3] bg-[#fff8f6] p-8 text-center"><h1 className="text-xl font-bold text-[#8c3e35]">暂时无法读取门店数据</h1><p className="mt-3 text-sm leading-6 text-[#9c655d]">{message}</p><Button onClick={onRetry} className="mt-6 bg-[#d66a4b] text-white hover:bg-[#bf573b]">重新连接</Button></div>; }

function Onboarding({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState({ name: "", slogan: "", address: "", phone: "" });
  const create = trpc.admin.createRestaurant.useMutation({ onSuccess: onCreated, onError: error => toast.error(error.message) });
  return <div className="min-h-screen bg-[#f7f6f1] p-5 sm:p-10"><div className="mx-auto max-w-2xl"><Link href="/"><div className="flex items-center gap-3 text-[#1d2926]"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#1d2926] text-white"><UtensilsCrossed className="h-5 w-5" /></div><span className="font-bold">桌边 / ORDER</span></div></Link><div className="mt-14 rounded-[2rem] border border-[#e1e3db] bg-[#fffefa] p-7 shadow-xl shadow-[#1d2926]/5 sm:p-10"><div className="mono text-[10px] uppercase tracking-[.25em] text-[#d66a4b]">FIRST SETUP</div><h1 className="mt-3 text-3xl font-extrabold tracking-tight">先把门店资料填好</h1><p className="mt-3 max-w-lg leading-7 text-[#738078]">系统不会自动创建示例菜品、分类或桌台。完成门店信息后，你可以从零录入真实经营数据。</p><form onSubmit={event => { event.preventDefault(); create.mutate(form); }} className="mt-8 grid gap-5 sm:grid-cols-2"><Field label="门店名称" required><Input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="例如：南巷小馆" required maxLength={120} /></Field><Field label="门店电话"><Input value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} placeholder="用于顾客联系" maxLength={40} /></Field><Field label="一句话介绍" className="sm:col-span-2"><Input value={form.slogan} onChange={event => setForm({ ...form, slogan: event.target.value })} placeholder="例如：家常菜，也认真对待每一桌" maxLength={240} /></Field><Field label="门店地址" className="sm:col-span-2"><Input value={form.address} onChange={event => setForm({ ...form, address: event.target.value })} placeholder="用于后台记录与顾客查看" maxLength={240} /></Field><Button disabled={create.isPending} type="submit" className="mt-2 h-12 rounded-xl bg-[#d66a4b] text-white hover:bg-[#bf573b] sm:col-span-2">{create.isPending ? "保存中…" : "保存门店，开始配置"}</Button></form></div></div></div>;
}

function Overview({ state, onGo }: { state: AdminState; onGo: (tab: Tab) => void }) { const pending = state.orders.filter(order => ["pending", "confirmed", "preparing", "ready"].includes(order.status)).length; const revenue = state.orders.filter(order => order.status !== "cancelled").reduce((sum, order) => sum + order.totalCents, 0); return <><PageHeading eyebrow="TODAY AT A GLANCE" title="经营概览" description="从真实业务数据开始，订单和菜单都由你的门店维护。" action={<Button onClick={() => onGo("orders")} className="bg-[#d66a4b] text-white hover:bg-[#bf573b]"><ClipboardList className="mr-2 h-4 w-4" />处理订单</Button>} /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Stat label="待处理订单" value={String(pending)} hint="当前进行中的订单" icon={ClipboardList} accent="orange" /><Stat label="今日订单总额" value={money(revenue)} hint="含未取消订单" icon={BarChart3} accent="green" /><Stat label="已配置桌台" value={String(state.tables.length)} hint="可生成独立二维码" icon={Table2} accent="purple" /><Stat label="已上架菜品" value={String(state.dishes.filter(dish => dish.isAvailable === 1).length)} hint={`共 ${state.dishes.length} 道菜品`} icon={UtensilsCrossed} accent="blue" /></div><div className="mt-7 grid gap-5 lg:grid-cols-[1.25fr_.75fr]"><div className="rounded-3xl border border-[#e1e3db] bg-[#fffefa] p-5 sm:p-7"><div className="flex items-center justify-between"><div><div className="font-bold">最近订单</div><div className="mt-1 text-sm text-[#7d887f]">按创建时间倒序显示</div></div><Button variant="ghost" onClick={() => onGo("orders")} className="text-[#b95439]">查看全部</Button></div><div className="mt-6">{state.orders.length === 0 ? <EmptyState icon={ClipboardList} title="还没有订单" text="顾客通过桌台二维码下单后，订单会出现在这里。" /> : <div className="divide-y divide-[#ecece5]">{state.orders.slice(0, 5).map(order => <div key={order.id} className="flex items-center justify-between gap-4 py-3"><div className="flex min-w-0 items-center gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#f2f4ed] text-[#587c6d]"><ReceiptIcon /></div><div className="min-w-0"><div className="mono truncate text-sm font-bold">{order.orderNumber}</div><div className="text-xs text-[#7d887f]">{dateTime(order.createdAt)} · {money(order.totalCents)}</div></div></div><StatusBadge status={order.status} /></div>)}</div>}</div></div><div className="rounded-3xl bg-[#1d2926] p-6 text-[#f7f6f1] shadow-xl shadow-[#1d2926]/10"><div className="mono text-[10px] uppercase tracking-[.22em] text-[#a7b6ad]">SETUP CHECKLIST</div><h3 className="mt-3 text-2xl font-bold">把门店接入每一张桌</h3><div className="mt-6 space-y-4"><Checklist done={Boolean(state.restaurant.name)} text="门店资料已创建" /><Checklist done={state.categories.length > 0} text="至少配置一个菜品分类" onClick={() => onGo("menu")} /><Checklist done={state.dishes.length > 0} text="录入并上架菜品" onClick={() => onGo("menu")} /><Checklist done={state.tables.length > 0} text="创建桌台二维码" onClick={() => onGo("tables")} /></div></div></div></>; }

function MenuManager({ state, onRefresh }: { state: AdminState; onRefresh: () => void }) { const [categoryName, setCategoryName] = useState(""); const [dish, setDish] = useState({ categoryId: "", name: "", description: "", price: "", imageUrl: "" }); const createCategory = trpc.admin.createCategory.useMutation({ onSuccess: () => { setCategoryName(""); onRefresh(); toast.success("分类已创建"); }, onError: error => toast.error(error.message) }); const createDish = trpc.admin.createDish.useMutation({ onSuccess: () => { setDish({ categoryId: dish.categoryId, name: "", description: "", price: "", imageUrl: "" }); onRefresh(); toast.success("菜品已创建"); }, onError: error => toast.error(error.message) }); const toggleDish = trpc.admin.setDishAvailability.useMutation({ onSuccess: onRefresh, onError: error => toast.error(error.message) }); return <><PageHeading eyebrow="MENU CATALOG" title="菜单管理" description="维护分类、菜名、说明与价格；下单时服务端会重新校验菜品状态。" /><div className="grid gap-5 xl:grid-cols-[.75fr_1.25fr]"><div className="space-y-5"><Panel title="新建分类" subtitle="例如：招牌菜、主食、饮品"><form onSubmit={event => { event.preventDefault(); if (categoryName.trim()) createCategory.mutate({ name: categoryName.trim(), sortOrder: state.categories.length }); }} className="flex gap-2"><Input value={categoryName} onChange={event => setCategoryName(event.target.value)} placeholder="分类名称" maxLength={80} /><Button type="submit" disabled={createCategory.isPending} className="shrink-0 bg-[#1d2926] text-white hover:bg-[#304640]"><Plus className="mr-1 h-4 w-4" />添加</Button></form></Panel><Panel title="新建菜品" subtitle="所有价格按人民币元填写"><form onSubmit={event => { event.preventDefault(); const cents = Math.round(Number(dish.price) * 100); if (!dish.categoryId || !dish.name.trim() || !Number.isFinite(cents) || cents <= 0) { toast.error("请完整填写分类、菜名和有效价格"); return; } createDish.mutate({ categoryId: Number(dish.categoryId), name: dish.name.trim(), description: dish.description, priceCents: cents, imageUrl: dish.imageUrl || undefined }); }} className="space-y-4"><Field label="所属分类" required><select value={dish.categoryId} onChange={event => setDish({ ...dish, categoryId: event.target.value })} className="h-10 w-full rounded-md border border-[#d7d8cf] bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#d66a4b]/30"><option value="">请选择分类</option>{state.categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></Field><Field label="菜品名称" required><Input value={dish.name} onChange={event => setDish({ ...dish, name: event.target.value })} placeholder="例如：砂锅鸡汤" maxLength={120} /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="价格（元）" required><Input type="number" min="0.01" step="0.01" value={dish.price} onChange={event => setDish({ ...dish, price: event.target.value })} placeholder="38.00" /></Field><Field label="图片地址"><Input type="url" value={dish.imageUrl} onChange={event => setDish({ ...dish, imageUrl: event.target.value })} placeholder="https://..." /></Field></div><Field label="菜品说明"><Textarea value={dish.description} onChange={event => setDish({ ...dish, description: event.target.value })} placeholder="口味、份量或过敏原说明" className="min-h-20 resize-none" maxLength={1000} /></Field><Button type="submit" disabled={createDish.isPending} className="w-full bg-[#d66a4b] text-white hover:bg-[#bf573b]">{createDish.isPending ? "保存中…" : "保存菜品"}</Button></form></Panel></div><Panel title="已配置菜单" subtitle={`${state.categories.length} 个分类 · ${state.dishes.length} 道菜品`}><div className="space-y-7">{state.categories.length === 0 ? <EmptyState icon={MenuIcon} title="还没有分类" text="先在左侧创建第一个分类，再录入真实菜品。" /> : state.categories.map(category => <div key={category.id}><div className="flex items-center justify-between border-b border-[#ecece5] pb-2"><h3 className="font-bold">{category.name}</h3><span className="text-xs text-[#8b968e]">{state.dishes.filter(dish => dish.categoryId === category.id).length} 道</span></div><div className="divide-y divide-[#f0f0e9]">{state.dishes.filter(dish => dish.categoryId === category.id).map(item => <div key={item.id} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><div className={`font-semibold ${item.isAvailable === 0 ? "text-[#a4aca5] line-through" : ""}`}>{item.name}</div><div className="mt-1 truncate text-xs text-[#7d887f]">{item.description || "未填写说明"}</div></div><div className="flex shrink-0 items-center gap-3"><span className="font-bold text-[#b95439]">{money(item.priceCents)}</span><button onClick={() => toggleDish.mutate({ dishId: item.id, isAvailable: item.isAvailable === 0 })} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${item.isAvailable === 1 ? "bg-[#e4f0e9] text-[#39705d]" : "bg-[#f0f1eb] text-[#7b867e]"}`}>{item.isAvailable === 1 ? "已上架" : "已下架"}</button></div></div>)}</div></div>)}</div></Panel></div></>; }

function TableManager({ state, onRefresh }: { state: AdminState; onRefresh: () => void }) {
  const [form, setForm] = useState({ name: "", code: "" });
  const [qr, setQr] = useState<Record<string, string>>({});
  const codePattern = TABLE_CODE_PATTERN;
  const trimmedName = form.name.trim();
  const trimmedCode = form.code.trim();
  const tableValidationError = validateTableInput(form);
  const canSubmit = !tableValidationError;
  const create = trpc.admin.createTable.useMutation({
    onSuccess: () => {
      setForm({ name: "", code: "" });
      onRefresh();
      toast.success("桌台已创建");
    },
    onError: error => toast.error(error.message),
  });

  useEffect(() => {
    let active = true;
    const run = async () => {
      const entries = await Promise.all(state.tables.map(async table => [
        table.code,
        await QRCode.toDataURL(`${window.location.origin}/menu?table=${encodeURIComponent(table.code)}`, {
          margin: 1,
          width: 180,
          color: { dark: "#1d2926", light: "#ffffff" },
        }),
      ] as const));
      if (active) setQr(Object.fromEntries(entries));
    };
    void run();
    return () => { active = false; };
  }, [state.tables]);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = validateTableInput(form);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    create.mutate({ name: trimmedName, code: trimmedCode });
  };

  const copyLink = async (code: string) => {
    await navigator.clipboard?.writeText(`${window.location.origin}/menu?table=${encodeURIComponent(code)}`);
    toast.success("点餐链接已复制");
  };

  return <>
    <PageHeading eyebrow="TABLE ACCESS" title="桌台与二维码" description="每张桌台对应一个独立 code。打印二维码后，顾客扫码即可进入本桌菜单。" />
    <div className="grid gap-5 xl:grid-cols-[.72fr_1.28fr]">
      <Panel title="新建桌台" subtitle="桌台码会出现在点餐链接中">
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="桌台名称" required>
            <Input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="例如：A01" maxLength={80} required aria-invalid={form.name.length > 0 && !trimmedName} />
          </Field>
          <Field label="桌台码" required>
            <Input value={form.code} onChange={event => setForm({ ...form, code: event.target.value })} placeholder="例如：A01" pattern="[a-zA-Z0-9_-]+" minLength={2} maxLength={40} required aria-invalid={form.code.length > 0 && !/^[a-zA-Z0-9_-]+$/.test(form.code.trim())} />
            {form.code.length > 0 && (trimmedCode.length < 2 || !codePattern.test(trimmedCode)) ? <p className="mt-2 text-xs text-[#b95439]">桌台码至少 2 位，只能使用字母、数字、下划线和短横线。</p> : <p className="mt-2 text-xs text-[#879189]">建议使用 A01、B02 这类易识别的编码。</p>}
          </Field>
          <Button disabled={create.isPending || !canSubmit} type="submit" className="w-full bg-[#1d2926] text-white hover:bg-[#304640] disabled:cursor-not-allowed disabled:opacity-50">{create.isPending ? "创建中…" : "创建桌台并生成二维码"}</Button>
        </form>
      </Panel>
      <Panel title="已配置桌台" subtitle={`${state.tables.length} 张桌台`}>
        <div className="grid gap-4 sm:grid-cols-2">
          {state.tables.length === 0 ? <div className="sm:col-span-2"><EmptyState icon={QrCode} title="还没有桌台" text="创建第一张桌台后，系统会生成可打印二维码。" /></div> : state.tables.map(table => {
            const url = `${window.location.origin}/menu?table=${encodeURIComponent(table.code)}`;
            return <div key={table.id} className="rounded-2xl border border-[#e4e5dd] bg-white p-4"><div className="flex items-start justify-between"><div><div className="font-bold">{table.name}</div><div className="mono mt-1 text-xs text-[#7d887f]">{table.code}</div></div><Badge className={table.status === "occupied" ? "bg-[#fff0db] text-[#9d6420]" : table.status === "disabled" ? "bg-[#f0f1eb] text-[#7b867e]" : "bg-[#e4f0e9] text-[#39705d]"}>{table.status === "occupied" ? "用餐中" : table.status === "disabled" ? "已停用" : "空闲"}</Badge></div><div className="mt-4 flex justify-center rounded-xl bg-[#f4f5ef] p-3">{qr[table.code] ? <img src={qr[table.code]} alt={`${table.name}点餐二维码`} className="h-36 w-36" /> : <div className="grid h-36 w-36 place-items-center text-xs text-[#8b968e]">生成中…</div>}</div><div className="mt-3 flex gap-2"><Button variant="outline" onClick={() => copyLink(table.code)} className="flex-1 border-[#d7d8cf] bg-white text-xs"><Copy className="mr-1.5 h-3.5 w-3.5" />复制链接</Button><a href={url} target="_blank" rel="noreferrer" className="grid h-9 w-9 place-items-center rounded-md border border-[#d7d8cf] text-[#68736d] hover:bg-[#fff3eb]" aria-label="打开点餐页面"><ExternalLink className="h-4 w-4" /></a></div></div>;
          })}
        </div>
      </Panel>
    </div>
  </>;
}

function OrderManager({ state, onRefresh }: { state: AdminState; onRefresh: () => void }) { const update = trpc.admin.updateOrderStatus.useMutation({ onSuccess: onRefresh, onError: error => toast.error(error.message) }); const itemMap = useMemo(() => { const map = new Map<number, string[]>(); for (const item of state.orderItems) { const list = map.get(item.orderId) ?? []; list.push(`${item.dishName} × ${item.quantity}`); map.set(item.orderId, list); } return map; }, [state.orderItems]); return <><PageHeading eyebrow="ORDER QUEUE" title="订单处理" description="订单状态由门店推进；完成或取消订单后，对应桌台会自动恢复为空闲。" /><div className="rounded-3xl border border-[#e1e3db] bg-[#fffefa] shadow-sm"><div className="flex items-center justify-between border-b border-[#ecece5] px-5 py-5 sm:px-7"><div><div className="font-bold">全部订单</div><div className="mt-1 text-sm text-[#7d887f]">最近 100 笔订单</div></div><Badge className="bg-[#fbe8dc] text-[#a54e36]">{state.orders.length} 笔</Badge></div>{state.orders.length === 0 ? <div className="p-10"><EmptyState icon={ClipboardList} title="还没有真实订单" text="顾客扫码下单后，订单会实时出现在这里。" /></div> : <div className="divide-y divide-[#ecece5]">{state.orders.map(order => <div key={order.id} className="grid gap-4 px-5 py-5 sm:grid-cols-[1fr_auto] sm:px-7"><div><div className="flex flex-wrap items-center gap-2"><span className="mono font-bold">{order.orderNumber}</span><StatusBadge status={order.status} /><span className="text-xs text-[#8b968e]">{dateTime(order.createdAt)}</span></div><div className="mt-3 flex flex-wrap gap-2 text-sm text-[#55645c]">{(itemMap.get(order.id) ?? []).map(item => <span key={item} className="rounded-lg bg-[#f1f3ed] px-2.5 py-1">{item}</span>)}</div>{order.customerNote && <div className="mt-3 rounded-xl bg-[#fff5e9] px-3 py-2 text-sm text-[#8b6338]">顾客备注：{order.customerNote}</div>}<div className="mt-3 font-bold text-[#b95439]">合计 {money(order.totalCents)} <span className="ml-2 text-xs font-normal text-[#8b968e]">· 到店支付 · {order.paymentStatus === "paid" ? "已支付" : "未支付"}</span></div></div><div className="flex items-center gap-2 sm:self-center"><select value={order.status} onChange={event => update.mutate({ orderId: order.id, status: event.target.value as typeof nextStatuses[number] })} className="h-10 min-w-28 rounded-lg border border-[#d7d8cf] bg-white px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#d66a4b]/30">{nextStatuses.map(status => <option key={status} value={status}>{orderStatus[status].label}</option>)}</select></div></div>)}</div>}</div></>; }

function SettingsManager({ state, onSaved }: { state: AdminState; onSaved: () => void }) { const [form, setForm] = useState({ name: state.restaurant.name, slogan: state.restaurant.slogan || "", address: state.restaurant.address || "", phone: state.restaurant.phone || "" }); const update = trpc.admin.updateRestaurant.useMutation({ onSuccess: () => { onSaved(); toast.success("门店设置已保存"); }, onError: error => toast.error(error.message) }); return <><PageHeading eyebrow="STORE PROFILE" title="门店设置" description="这些信息会显示在顾客菜单顶部，修改后立即生效。" /><div className="max-w-2xl"><Panel title="门店资料" subtitle="不影响已有订单和桌台二维码"><form onSubmit={event => { event.preventDefault(); update.mutate(form); }} className="space-y-5"><Field label="门店名称" required><Input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} maxLength={120} required /></Field><Field label="一句话介绍"><Input value={form.slogan} onChange={event => setForm({ ...form, slogan: event.target.value })} maxLength={240} /></Field><Field label="门店电话"><Input value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} maxLength={40} /></Field><Field label="门店地址"><Input value={form.address} onChange={event => setForm({ ...form, address: event.target.value })} maxLength={240} /></Field><Button type="submit" disabled={update.isPending} className="bg-[#d66a4b] text-white hover:bg-[#bf573b]">{update.isPending ? "保存中…" : "保存设置"}</Button></form></Panel></div></>; }

type AdminState = NonNullable<BackendAdminState>;
function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) { return <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><div className="mono text-[10px] uppercase tracking-[.24em] text-[#d66a4b]">{eyebrow}</div><h2 className="mt-2 text-3xl font-extrabold tracking-tight">{title}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#738078]">{description}</p></div>{action}</div>; }
function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) { return <section className="rounded-3xl border border-[#e1e3db] bg-[#fffefa] p-5 shadow-sm sm:p-7"><div className="mb-5"><h3 className="font-bold">{title}</h3>{subtitle && <p className="mt-1 text-sm text-[#7d887f]">{subtitle}</p>}</div>{children}</section>; }
function Field({ label, required, children, className = "" }: { label: string; required?: boolean; children: React.ReactNode; className?: string }) { return <label className={`block text-sm font-semibold ${className}`}>{label}{required && <span className="ml-1 text-[#d66a4b]">*</span>}<div className="mt-2">{children}</div></label>; }
function Stat({ label, value, hint, icon: Icon, accent }: { label: string; value: string; hint: string; icon: React.ComponentType<{ className?: string }>; accent: string }) { const colors: Record<string, string> = { orange: "bg-[#fff0e6] text-[#b95439]", green: "bg-[#e5f0eb] text-[#39705d]", purple: "bg-[#eee8f7] text-[#68508b]", blue: "bg-[#e7eff4] text-[#3b6476]" }; return <div className="rounded-3xl border border-[#e1e3db] bg-[#fffefa] p-5 shadow-sm"><div className="flex items-center justify-between"><div className={`grid h-10 w-10 place-items-center rounded-xl ${colors[accent]}`}><Icon className="h-5 w-5" /></div><BarChart3 className="h-4 w-4 text-[#c4cbc4]" /></div><div className="mt-5 text-3xl font-extrabold tracking-tight">{value}</div><div className="mt-1 font-semibold">{label}</div><div className="mt-1 text-xs text-[#8b968e]">{hint}</div></div>; }
function StatusBadge({ status }: { status: string }) { const config = orderStatus[status] ?? orderStatus.pending; return <Badge className={config.className}>{config.label}</Badge>; }
function Checklist({ done, text, onClick }: { done: boolean; text: string; onClick?: () => void }) { return <button disabled={!onClick} onClick={onClick} className={`flex w-full items-center gap-3 text-left text-sm ${onClick ? "hover:text-white" : ""}`}><span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${done ? "border-[#82c1a6] bg-[#82c1a6] text-[#1d2926]" : "border-[#5d7468] text-transparent"}`}><Check className="h-3 w-3" /></span><span className={done ? "text-[#d0ddd3]" : "text-[#91a096]"}>{text}</span></button>; }
function EmptyState({ icon: Icon, title, text }: { icon: React.ComponentType<{ className?: string }>; title: string; text: string }) { return <div className="py-7 text-center"><Icon className="mx-auto h-9 w-9 text-[#afb8b0]" /><div className="mt-3 font-semibold">{title}</div><p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-[#879189]">{text}</p></div>; }
function ReceiptIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 3h14v18l-3-2-4 2-4-2-3 2z"/><path d="M8 8h8M8 12h8M8 16h4"/></svg>; }
