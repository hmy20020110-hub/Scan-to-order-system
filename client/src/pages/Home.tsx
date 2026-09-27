import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { Button } from "@/components/ui/button";
import { ArrowRight, ClipboardList, QrCode, ShieldCheck, Store, UtensilsCrossed } from "lucide-react";
import { Link } from "wouter";

const steps = [
  { icon: Store, title: "创建门店", text: "登录管理端，填写真实门店信息。" },
  { icon: UtensilsCrossed, title: "录入菜单", text: "按实际分类、菜品与价格维护菜单。" },
  { icon: QrCode, title: "绑定桌台", text: "为每张桌生成独立二维码并打印。" },
  { icon: ClipboardList, title: "接收订单", text: "顾客扫码下单，后厨按状态推进。" },
];

export default function Home() {
  const { user, loading } = useAuth();

  return (
    <div className="min-h-screen overflow-hidden bg-[#f7f6f1]">
      <header className="container flex items-center justify-between py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#1d2926] text-[#f7f6f1] shadow-lg shadow-[#1d2926]/10">
            <UtensilsCrossed className="h-5 w-5" />
          </div>
          <div>
            <div className="font-bold tracking-tight text-[#1d2926]">桌边 / ORDER</div>
            <div className="mono text-[10px] uppercase tracking-[.24em] text-[#8a928b]">scan to order</div>
          </div>
        </div>
        <Link href="/admin">
          <Button variant="outline" className="border-[#cfd4cb] bg-transparent text-[#1d2926] hover:bg-white">
            管理后台 <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </header>

      <main>
        <section className="container soft-grid relative grid gap-12 pb-20 pt-12 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:pb-28 lg:pt-20">
          <div className="relative z-10 fade-up">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#e2b7a2] bg-[#fff6ef] px-3 py-1.5 text-sm font-medium text-[#9b4d37]">
              <span className="h-2 w-2 rounded-full bg-[#d66a4b]" />
              门店可直接使用 · 不预置演示数据
            </div>
            <h1 className="max-w-3xl text-5xl font-extrabold leading-[1.08] tracking-[-.06em] text-[#1d2926] sm:text-6xl lg:text-7xl">
              让每一张桌，<br /><span className="text-[#d66a4b]">自己会点餐。</span>
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-[#5f6d66]">
              顾客扫码浏览真实菜单、提交订单；商家在一个清晰的后台管理菜品、桌台与出餐状态。数据从空白开始，由你的门店掌控。
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/admin">
                <Button size="lg" className="pressable bg-[#d66a4b] px-6 text-white shadow-xl shadow-[#d66a4b]/20 hover:bg-[#bf573b]">
                  {user ? "进入我的门店" : "登录并创建门店"} <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <a href="#how-it-works">
                <Button size="lg" variant="outline" className="border-[#cfd4cb] bg-white/60 px-6 text-[#1d2926] hover:bg-white">
                  了解流程
                </Button>
              </a>
            </div>
            {!loading && !user && <p className="mt-4 text-xs text-[#8a928b]">商家管理端使用安全登录；顾客无需登录即可扫码下单。</p>}
          </div>

          <div className="relative mx-auto w-full max-w-md lg:justify-self-end">
            <div className="absolute -right-8 -top-12 h-36 w-36 rounded-full bg-[#e7b35a]/25 blur-2xl" />
            <div className="absolute -bottom-8 -left-10 h-44 w-44 rounded-full bg-[#d66a4b]/15 blur-3xl" />
            <div className="relative rotate-2 rounded-[2.25rem] border border-[#dfe1d8] bg-[#1d2926] p-4 shadow-2xl shadow-[#1d2926]/20">
              <div className="rounded-[1.6rem] bg-[#f7f6f1] p-5 sm:p-7">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="mono text-[10px] uppercase tracking-[.22em] text-[#8b968e]">TABLE SERVICE</div>
                    <div className="mt-2 text-xl font-bold tracking-tight text-[#1d2926]">扫码进入菜单</div>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f3d2bf] text-[#a54e36]"><QrCode className="h-5 w-5" /></div>
                </div>
                <div className="mx-auto my-10 grid aspect-square max-w-[240px] place-items-center rounded-3xl bg-white p-6 shadow-inner">
                  <div className="grid grid-cols-7 gap-1.5 opacity-80" aria-hidden="true">
                    {Array.from({ length: 49 }).map((_, index) => <span key={index} className={`h-3.5 w-3.5 rounded-[2px] ${[0,1,2,7,9,14,15,16,21,28,30,35,36,37,42,44,45,46].includes(index) || index % 5 === 0 ? "bg-[#1d2926]" : "bg-[#eef0e9]"}`} />)}
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-[#e2e3db] pt-4 text-xs text-[#7d887f]"><span>桌台二维码</span><span className="mono">/menu?table=...</span></div>
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="border-y border-[#e3e4dc] bg-white/60 py-16">
          <div className="container">
            <div className="mb-9 flex items-end justify-between gap-6">
              <div><div className="mono text-xs uppercase tracking-[.24em] text-[#d66a4b]">THE WORKFLOW</div><h2 className="mt-2 text-3xl font-bold tracking-tight text-[#1d2926]">从空白开始，四步上线</h2></div>
              <div className="hidden max-w-xs text-right text-sm leading-6 text-[#7a857e] sm:block">系统不创建任何假菜单、假订单或假桌台，所有内容都属于你的门店。</div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((step, index) => <div key={step.title} className="fade-up rounded-2xl border border-[#e1e3db] bg-[#fffefa] p-5 shadow-sm" style={{ animationDelay: `${index * 60}ms` }}><div className="flex items-center justify-between"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#edf3ef] text-[#3e6f63]"><step.icon className="h-5 w-5" /></div><span className="mono text-xs text-[#b0b7af]">0{index + 1}</span></div><h3 className="mt-6 font-bold text-[#1d2926]">{step.title}</h3><p className="mt-2 text-sm leading-6 text-[#738078]">{step.text}</p></div>)}
            </div>
          </div>
        </section>

        <section className="container flex flex-col gap-5 py-16 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3"><ShieldCheck className="mt-1 h-5 w-5 text-[#5e887b]" /><div><div className="font-semibold text-[#1d2926]">订单价格以服务端菜品数据为准</div><p className="mt-1 text-sm text-[#7a857e]">提交订单时后端会再次校验菜品状态与价格，避免前端篡改或过期数据。</p></div></div>
          <Link href="/admin"><Button variant="ghost" className="self-start text-[#a54e36] hover:bg-[#fff1e9] hover:text-[#8d3f2e]">打开商家后台 <ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
        </section>
      </main>
    </div>
  );
}
