import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronRight, CreditCard, Minus, Plus, ReceiptText, ShoppingBag, UtensilsCrossed, WalletCards, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

const money = (cents: number) => `¥${(cents / 100).toFixed(2)}`;
type DishData = { id: number; categoryId: number; name: string; description: string | null; priceCents: number; imageUrl: string | null; specifications: string | null };
type SpecGroup = { name: string; options: Array<{ name: string; priceDeltaCents: number }> };
type SelectedSpec = { group: string; option: string; priceDeltaCents: number };
function parseDishSpecs(value: string | null | undefined): SpecGroup[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((group): group is SpecGroup => Boolean(group && typeof group === "object" && typeof (group as SpecGroup).name === "string" && Array.isArray((group as SpecGroup).options))).map(group => ({ name: group.name, options: group.options.filter(option => Boolean(option && typeof option.name === "string" && Number.isInteger(option.priceDeltaCents))) }));
  } catch { return []; }
}
function selectedSpecsForDish(dish: DishData, selections: Record<string, string> | undefined): SelectedSpec[] {
  return parseDishSpecs(dish.specifications).map(group => {
    const optionName = selections?.[group.name] ?? group.options[0]?.name;
    const option = group.options.find(candidate => candidate.name === optionName);
    return option ? { group: group.name, option: option.name, priceDeltaCents: option.priceDeltaCents } : null;
  }).filter((item): item is SelectedSpec => Boolean(item));
}

export default function CustomerMenu() {
  const tableCode = new URLSearchParams(window.location.search).get("table") ?? "";
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [cart, setCart] = useState<Record<number, number>>({});
  const [specSelections, setSpecSelections] = useState<Record<number, Record<string, string>>>({});
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [customerNote, setCustomerNote] = useState("");
  const [paymentOrder, setPaymentOrder] = useState<{ orderNumber: string; totalCents: number; tableName: string; paymentMethod: "on_site" | "wechat"; paymentStatus: "unpaid" | "pending" | "paid" | "refunded" } | null>(null);

  const menuQuery = trpc.public.menu.useQuery(
    { tableCode },
    { enabled: Boolean(tableCode), retry: false },
  );
  const createOrder = trpc.public.order.create.useMutation({
    onSuccess: result => {
      setPaymentOrder(result);
      setCart({});
      setCustomerNote("");
      setCheckoutOpen(false);
      toast.success("订单已提交，进入支付页面");
    },
    onError: error => toast.error(error.message),
  });

  const menu = menuQuery.data;
  const categories = menu?.categories ?? [];
  const dishes = menu?.dishes ?? [];
  const selectedCategory = activeCategory ?? categories[0]?.id ?? null;
  const visibleDishes = useMemo(
    () => dishes.filter(dish => dish.categoryId === selectedCategory),
    [dishes, selectedCategory],
  );
  const cartItems = useMemo(
    () => dishes.filter(dish => (cart[dish.id] ?? 0) > 0).map(dish => {
      const specs = selectedSpecsForDish(dish, specSelections[dish.id]);
      const unitPriceCents = dish.priceCents + specs.reduce((sum, spec) => sum + spec.priceDeltaCents, 0);
      return { dish, quantity: cart[dish.id] ?? 0, specs, unitPriceCents, specificationNote: specs.map(spec => `${spec.group}：${spec.option}`).join(" / ") };
    }),
    [cart, dishes, specSelections],
  );
  const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalCents = cartItems.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);

  const changeQuantity = (dishId: number, delta: number) => {
    setCart(current => {
      const nextQuantity = Math.max(0, (current[dishId] ?? 0) + delta);
      const next = { ...current };
      if (nextQuantity === 0) delete next[dishId];
      else next[dishId] = nextQuantity;
      return next;
    });
  };

  if (!tableCode) {
    return <InvalidTable />;
  }

  if (menuQuery.isLoading) {
    return <div className="grid min-h-screen place-items-center bg-[#f7f6f1] text-[#66736c]"><div className="text-center"><div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-[#ead5c8] border-t-[#d66a4b]" /><p>正在读取本桌菜单…</p></div></div>;
  }

  if (menuQuery.error || !menu) {
    return <InvalidTable detail={menuQuery.error?.message} />;
  }

  if (paymentOrder) {
    return <PaymentPage restaurantName={menu.restaurant.name} tableName={menu.table.name} order={paymentOrder} onBack={() => setPaymentOrder(null)} />;
  }

  return (
    <div className="min-h-screen bg-[#f7f6f1] pb-28 text-[#1d2926]">
      <header className="sticky top-0 z-30 border-b border-[#e4e3da] bg-[#f7f6f1]/95 backdrop-blur">
        <div className="container flex items-center justify-between py-4">
          <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#1d2926] text-[#f7f6f1]"><UtensilsCrossed className="h-5 w-5" /></div><div><h1 className="font-bold tracking-tight">{menu.restaurant.name}</h1><p className="text-xs text-[#7a857e]">{menu.table.name} · 在线点餐</p></div></div>
          <Link href="/"><Button variant="ghost" size="icon" className="rounded-full text-[#637067] hover:bg-white"><ArrowLeft className="h-5 w-5" /></Button></Link>
        </div>
      </header>

      <main className="container pt-7">
        <div className="mb-8 rounded-3xl bg-[#1d2926] p-6 text-[#f7f6f1] shadow-xl shadow-[#1d2926]/10 sm:p-8"><div className="flex items-end justify-between gap-5"><div><div className="mono text-[10px] uppercase tracking-[.25em] text-[#a6b4aa]">WELCOME TO OUR TABLE</div><h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">{menu.restaurant.slogan || "请按需点餐"}</h2><p className="mt-3 text-sm text-[#c5d0c8]">桌台：{menu.table.name} · 菜品和价格以当前菜单为准</p></div><div className="hidden rounded-2xl border border-[#53655d] bg-[#2b3c37] px-4 py-3 text-right sm:block"><div className="mono text-[10px] text-[#a6b4aa]">TABLE</div><div className="mt-1 text-xl font-bold">{menu.table.name}</div></div></div></div>

        {categories.length === 0 || dishes.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[#cbd2c9] bg-white/60 px-6 py-16 text-center"><ReceiptText className="mx-auto h-10 w-10 text-[#a7b0a8]" /><h3 className="mt-4 text-lg font-bold">菜单正在准备中</h3><p className="mt-2 text-sm text-[#79867e]">商家还没有发布可点菜品，请稍后再试。</p></div>
        ) : <>
          <nav className="mb-7 flex gap-2 overflow-x-auto pb-1" aria-label="菜品分类">{categories.map(category => <button key={category.id} onClick={() => setActiveCategory(category.id)} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors ${selectedCategory === category.id ? "bg-[#d66a4b] text-white shadow-md shadow-[#d66a4b]/20" : "bg-white text-[#6f7b73] hover:bg-[#fff3eb]"}`}>{category.name}</button>)}</nav>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{visibleDishes.map((dish, index) => <DishCard key={dish.id} dish={dish} quantity={cart[dish.id] ?? 0} selections={specSelections[dish.id]} onSelectionChange={(group, option) => setSpecSelections(current => ({ ...current, [dish.id]: { ...(current[dish.id] ?? {}), [group]: option } }))} onChangeQuantity={changeQuantity} animationDelay={index * 45} />)}</section>
        </>}
      </main>

      {itemCount > 0 && <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#dedfd7] bg-[#f7f6f1]/95 p-3 shadow-[0_-12px_32px_rgba(29,41,38,.08)] backdrop-blur"><div className="container"><Button onClick={() => setCheckoutOpen(true)} className="pressable h-14 w-full justify-between rounded-2xl bg-[#d66a4b] px-5 text-white shadow-lg shadow-[#d66a4b]/20 hover:bg-[#bf573b]"><span className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-xl bg-white/15"><ShoppingBag className="h-4 w-4" /></span><span>{itemCount} 件菜品 · 提交订单</span></span><span className="flex items-center gap-1 font-bold">{money(totalCents)}<ChevronRight className="h-5 w-5" /></span></Button></div></div>}

      {checkoutOpen && <CheckoutDialog cartItems={cartItems} totalCents={totalCents} customerNote={customerNote} setCustomerNote={setCustomerNote} pending={createOrder.isPending} onClose={() => setCheckoutOpen(false)} onSubmit={paymentMethod => createOrder.mutate({ tableCode, customerNote, paymentMethod, items: cartItems.map(item => ({ dishId: item.dish.id, quantity: item.quantity, specs: item.specs.map(spec => ({ group: spec.group, option: spec.option })) })) })} />}
    </div>
  );
}

function DishCard({ dish, quantity, selections, onSelectionChange, onChangeQuantity, animationDelay }: { dish: DishData; quantity: number; selections?: Record<string, string>; onSelectionChange: (group: string, option: string) => void; onChangeQuantity: (dishId: number, delta: number) => void; animationDelay: number }) {
  const groups = parseDishSpecs(dish.specifications);
  const specs = selectedSpecsForDish(dish, selections);
  const unitPriceCents = dish.priceCents + specs.reduce((sum, spec) => sum + spec.priceDeltaCents, 0);
  return <article className="fade-up group rounded-3xl border border-[#e3e3db] bg-white/80 p-4 shadow-sm" style={{ animationDelay: `${animationDelay}ms` }}><div className="flex gap-4"><div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-2xl bg-[#f2e9df] text-[#b67c5f]">{dish.imageUrl ? <img src={dish.imageUrl} alt={dish.name} className="h-full w-full object-cover" /> : <UtensilsCrossed className="h-7 w-7" />}</div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><h3 className="font-bold leading-6">{dish.name}</h3>{quantity > 0 && <Badge className="bg-[#fbe8dc] text-[#a54e36] hover:bg-[#fbe8dc]">已选 {quantity}</Badge>}</div><p className="mt-1 line-clamp-2 min-h-10 text-sm leading-5 text-[#7a857e]">{dish.description || "商家未填写菜品说明"}</p>{groups.length > 0 && <div className="mt-3 space-y-2">{groups.map(group => <label key={group.name} className="flex items-center justify-between gap-2 text-xs text-[#68736d]"><span className="shrink-0 font-semibold">{group.name}</span><select value={selections?.[group.name] ?? group.options[0]?.name ?? ""} onChange={event => onSelectionChange(group.name, event.target.value)} className="h-8 min-w-0 flex-1 rounded-lg border border-[#e1e3db] bg-white px-2 text-xs outline-none focus:ring-2 focus:ring-[#d66a4b]/30">{group.options.map(option => <option key={option.name} value={option.name}>{option.name}{option.priceDeltaCents > 0 ? ` +${money(option.priceDeltaCents)}` : ""}</option>)}</select></label>)}</div>}<div className="mt-3 flex items-center justify-between"><span className="font-bold text-[#b95439]">{money(unitPriceCents)}{groups.length > 0 && <span className="ml-1 text-[10px] font-normal text-[#9b7565]">起</span>}</span><div className="flex items-center gap-2">{quantity > 0 && <button onClick={() => onChangeQuantity(dish.id, -1)} className="grid h-8 w-8 place-items-center rounded-full bg-[#f0f1eb] text-[#5e6b63] hover:bg-[#e5e7de]" aria-label={`减少${dish.name}`}><Minus className="h-4 w-4" /></button>}<button onClick={() => onChangeQuantity(dish.id, 1)} className="grid h-8 w-8 place-items-center rounded-full bg-[#1d2926] text-white shadow-md shadow-[#1d2926]/10 hover:bg-[#304640]" aria-label={`添加${dish.name}`}><Plus className="h-4 w-4" /></button></div></div></div></div></article>;
}

function InvalidTable({ detail }: { detail?: string }) {
  return <div className="grid min-h-screen place-items-center bg-[#f7f6f1] p-6 text-center"><div className="max-w-md"><div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-[#fbe8dc] text-[#b95439]"><QrCodeIcon /></div><h1 className="mt-6 text-2xl font-extrabold text-[#1d2926]">二维码不可用</h1><p className="mt-3 leading-7 text-[#738078]">{detail || "请通过桌台上的二维码进入点餐页面，不要手动输入地址。"}</p><Link href="/"><Button className="mt-7 bg-[#1d2926] text-white hover:bg-[#304640]">返回首页</Button></Link></div></div>;
}

function QrCodeIcon() { return <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM19 19h2v2h-2zM19 14h2M14 19h2" /></svg>; }

function CheckoutDialog({ cartItems, totalCents, customerNote, setCustomerNote, pending, onClose, onSubmit }: { cartItems: Array<{ dish: { id: number; name: string; priceCents: number }; quantity: number; unitPriceCents: number; specificationNote: string }>; totalCents: number; customerNote: string; setCustomerNote: (value: string) => void; pending: boolean; onClose: () => void; onSubmit: (paymentMethod: "on_site" | "wechat") => void }) {
  const [paymentMethod, setPaymentMethod] = useState<"on_site" | "wechat">("on_site");
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#1d2926]/45 p-0 sm:items-center sm:p-5"><div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-[#fffefa] p-5 shadow-2xl sm:rounded-3xl sm:p-7"><div className="flex items-center justify-between"><div><div className="mono text-[10px] uppercase tracking-[.22em] text-[#d66a4b]">STEP 02 / CONFIRM</div><h2 className="mt-1 text-2xl font-bold">确认订单</h2></div><button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-[#f0f1eb] text-[#68736d] hover:bg-[#e5e7de]" aria-label="关闭"><X className="h-5 w-5" /></button></div><div className="mt-6 divide-y divide-[#ecece5] rounded-2xl border border-[#e5e5dd] bg-white">{cartItems.map(item => <div key={item.dish.id} className="flex items-center justify-between px-4 py-3"><div><div className="font-semibold">{item.dish.name}</div>{item.specificationNote && <div className="mt-1 text-xs text-[#b95439]">{item.specificationNote}</div>}<div className="text-xs text-[#7a857e]">{money(item.unitPriceCents)} × {item.quantity}</div></div><div className="font-semibold text-[#b95439]">{money(item.unitPriceCents * item.quantity)}</div></div>)}</div><label className="mt-6 block text-sm font-semibold">备注 <span className="font-normal text-[#9ca59e]">（可选）</span><Textarea value={customerNote} onChange={event => setCustomerNote(event.target.value)} placeholder="例如：少辣、不要香菜" className="mt-2 min-h-20 resize-none bg-white" maxLength={500} /></label><div className="mt-6"><div className="text-sm font-semibold">选择支付方式</div><div className="mt-3 grid gap-2"><button type="button" onClick={() => setPaymentMethod("on_site")} className={`flex items-center justify-between rounded-2xl border p-4 text-left transition-colors ${paymentMethod === "on_site" ? "border-[#d66a4b] bg-[#fff4ed]" : "border-[#e1e3db] bg-white hover:bg-[#faf8f2]"}`}><span className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e5f0eb] text-[#39705d]"><WalletCards className="h-5 w-5" /></span><span><span className="block font-semibold">到店支付</span><span className="mt-1 block text-xs font-normal text-[#7d887f]">提交后商家立即收到订单，到店结账</span></span></span><span className={`h-4 w-4 rounded-full border-2 ${paymentMethod === "on_site" ? "border-[#d66a4b] bg-[#d66a4b] shadow-[inset_0_0_0_3px_#fff4ed]" : "border-[#c9d0c9]"}`} /></button><button type="button" disabled className="flex cursor-not-allowed items-center justify-between rounded-2xl border border-[#e1e3db] bg-[#f3f4ef] p-4 text-left opacity-70"><span className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#ece8f5] text-[#68508b]"><CreditCard className="h-5 w-5" /></span><span><span className="block font-semibold">微信支付</span><span className="mt-1 block text-xs font-normal text-[#8b968e]">待商家配置微信支付商户号</span></span></span><span className="rounded-full bg-[#e4e6df] px-2 py-1 text-[10px] font-semibold text-[#7d887f]">待配置</span></button></div></div><div className="mt-6 flex items-center justify-between border-t border-[#e5e5dd] pt-5"><span className="text-sm text-[#718078]">提交后进入支付界面</span><span className="text-xl font-extrabold text-[#b95439]">{money(totalCents)}</span></div><Button onClick={() => onSubmit(paymentMethod)} disabled={pending} className="mt-5 h-12 w-full rounded-xl bg-[#d66a4b] font-bold text-white hover:bg-[#bf573b]">{pending ? "提交中…" : "确认订单并进入支付"}</Button></div></div>;
}

function PaymentPage({ restaurantName, tableName, order, onBack }: { restaurantName: string; tableName: string; order: { orderNumber: string; totalCents: number; paymentMethod: "on_site" | "wechat"; paymentStatus: "unpaid" | "pending" | "paid" | "refunded" }; onBack: () => void }) {
  const isWechat = order.paymentMethod === "wechat";
  return <div className="grid min-h-screen place-items-center bg-[#f7f6f1] p-5"><div className="w-full max-w-md rounded-[2rem] border border-[#e1e3db] bg-[#fffefa] p-7 shadow-xl shadow-[#1d2926]/5 sm:p-10"><div className="flex items-center justify-center gap-2 text-[10px] font-semibold uppercase tracking-[.18em] text-[#9da79f]"><span className="rounded-full bg-[#e2f0e8] px-2.5 py-1 text-[#39705d]">01 选菜</span><ArrowRight className="h-3.5 w-3.5" /><span className="rounded-full bg-[#e2f0e8] px-2.5 py-1 text-[#39705d]">02 确认</span><ArrowRight className="h-3.5 w-3.5" /><span className="rounded-full bg-[#fbe8dc] px-2.5 py-1 text-[#a54e36]">03 支付</span></div><div className={`mx-auto mt-8 grid h-16 w-16 place-items-center rounded-full ${isWechat ? "bg-[#eee8f7] text-[#68508b]" : "bg-[#e2f0e8] text-[#39705d]"}`}>{isWechat ? <CreditCard className="h-8 w-8" /> : <WalletCards className="h-8 w-8" />}</div><div className="mono mt-7 text-center text-[10px] uppercase tracking-[.25em] text-[#8b968e]">PAYMENT</div><h1 className="mt-2 text-center text-3xl font-extrabold tracking-tight">{isWechat ? "微信支付" : "到店支付"}</h1><p className="mt-3 text-center leading-6 text-[#738078]">{isWechat ? "当前门店尚未完成微信支付配置，请联系商家。" : "订单已经送达商家后台，请向店员完成支付。"}<br />{restaurantName} · {tableName}</p><div className="my-8 rounded-2xl bg-[#f2f4ed] px-5 py-4"><div className="flex items-center justify-between text-xs text-[#7d887f]"><span>订单号</span><span>待支付</span></div><div className="mono mt-2 text-2xl font-bold tracking-widest text-[#1d2926]">{order.orderNumber}</div><div className="mt-2 text-sm font-semibold text-[#b95439]">待支付 {money(order.totalCents)}</div></div><div className="flex items-center gap-3 rounded-2xl border border-[#e1e3db] bg-white p-4 text-sm text-[#68736d]"><CheckCircle2 className="h-5 w-5 shrink-0 text-[#39705d]" /><span>商家后台已收到订单，当前支付状态：{order.paymentStatus === "paid" ? "已支付" : "未支付"}</span></div><Button onClick={onBack} className="mt-6 h-11 w-full rounded-xl bg-[#1d2926] text-white hover:bg-[#304640]">返回菜单</Button></div></div>;
}
