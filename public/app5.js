// ---- темы игр: сайт «переодевается» под игру + закреплённый выгодный продавец
const svgU = s => "url(\"data:image/svg+xml;utf8," + encodeURIComponent(s) + "\")";
const SV = (w, h, body, col, op) => svgU(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}' fill='none' stroke='${col}' stroke-opacity='${Math.min(.5,op*1.6)}' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round'>${body}</svg>`);
const PAT = {
  // прицел и силуэты оружия
  cs: c => SV(150, 150, `<circle cx='30' cy='30' r='9'/><path d='M30 14v9M30 37v9M14 30h9M37 30h9'/><path d='M82 96h46l5 5h8v6h-14l-3 4h-10l-2 8h-8l1-8H82z'/><path d='M96 60l22 0 4 4h-26z'/>`, c, .22),
  // руны и магия
  magic: c => SV(140, 140, `<path d='M30 12l5 12 13 1-10 8 3 13-11-7-11 7 3-13-10-8 13-1z'/><circle cx='100' cy='90' r='16'/><path d='M100 74v32M84 90h32M89 79l22 22M111 79l-22 22'/><path d='M40 100q10-14 20 0t20 0'/>`, c, .2),
  // острые осколки
  shard: c => SV(120, 120, `<path d='M10 100L40 20l12 50z'/><path d='M70 110l20-50 26 30z'/><path d='M60 20h40l-12 24z'/>`, c, .2),
  // пиксельные блоки
  block: c => SV(96, 96, `<rect x='6' y='6' width='28' height='28'/><rect x='50' y='38' width='28' height='28'/><rect x='14' y='58' width='16' height='16'/><path d='M6 20h28M20 6v28'/>`, c, .22),
  // шестигранники
  hex: c => SV(100, 116, `<path d='M50 6l40 22v44L50 94 10 72V28z'/><path d='M50 30l18 10v20L50 70 32 60V40z'/>`, c, .2),
  // звёзды
  star: c => SV(120, 120, `<path d='M60 12l9 24 25 2-19 16 6 25-21-14-21 14 6-25-19-16 25-2z'/><circle cx='20' cy='100' r='3'/><circle cx='104' cy='20' r='2'/>`, c, .2),
  // сетка/город
  grid: c => SV(110, 110, `<path d='M0 55h110M55 0v110'/><rect x='20' y='20' width='30' height='30'/><rect x='62' y='66' width='30' height='30'/>`, c, .16),
  // самолёт/военное
  mil: c => SV(130, 130, `<path d='M20 40l30-8 30 8M50 32v-14M35 100h60M40 100l10-24h30l10 24'/><circle cx='100' cy='36' r='8'/>`, c, .2),
  // волны/кубики
  wave: c => SV(120, 80, `<path d='M0 40q15-20 30 0t30 0 30 0 30 0'/><path d='M0 66q15-20 30 0t30 0 30 0 30 0'/>`, c, .2),
  // кольца
  ring: c => SV(120, 120, `<circle cx='60' cy='60' r='40'/><circle cx='60' cy='60' r='22'/><circle cx='60' cy='60' r='4'/>`, c, .18),
};
// bg — тёмная подложка, a — акцент рисунка, g — вторая подсветка
const GT = {
  cs2: { n: "Counter-Strike 2", bg: "#06142e", g: "#0d3a7a", a: "#58a6ff", p: "cs" },
  dota2: { n: "Dota 2", bg: "#240608", g: "#7a1218", a: "#ff4a3d", p: "magic" },
  valorant: { n: "Valorant", bg: "#0f1923", g: "#4a1018", a: "#ff4655", p: "shard" },
  minecraft: { n: "Minecraft", bg: "#10200f", g: "#2c5a1c", a: "#7bd34a", p: "block" },
  roblox: { n: "Roblox", bg: "#14161d", g: "#5a1414", a: "#ff3b30", p: "block" },
  fortnite: { n: "Fortnite", bg: "#150d3a", g: "#3d1f9e", a: "#8fb8ff", p: "star" },
  pubg: { n: "PUBG", bg: "#1b1a10", g: "#5a4a10", a: "#f0b429", p: "mil" },
  "pubg-mobile": { n: "PUBG Mobile", bg: "#1b1a10", g: "#5a4a10", a: "#f0b429", p: "mil" },
  gta: { n: "GTA", bg: "#07170d", g: "#14502a", a: "#4ade80", p: "grid" },
  genshin: { n: "Genshin Impact", bg: "#0e1d2e", g: "#5a4a22", a: "#f0d28a", p: "star" },
  hsr: { n: "Honkai: Star Rail", bg: "#0d0b24", g: "#37208a", a: "#c4b5fd", p: "ring" },
  lol: { n: "League of Legends", bg: "#050f22", g: "#5a4a22", a: "#c8aa6e", p: "hex" },
  wow: { n: "World of Warcraft", bg: "#1a1208", g: "#6b2a0a", a: "#f59e0b", p: "shard" },
  "war-thunder": { n: "War Thunder", bg: "#14180f", g: "#3b4a1c", a: "#a3b86c", p: "mil" },
  steam: { n: "Steam", bg: "#0b1622", g: "#1b4a6e", a: "#66c0f4", p: "ring" },
  playstation: { n: "PlayStation", bg: "#05123a", g: "#0a3ea0", a: "#5aa0ff", p: "grid" },
  xbox: { n: "Xbox", bg: "#07160a", g: "#14641c", a: "#5fdc5f", p: "ring" },
  telegram: { n: "Telegram", bg: "#06192a", g: "#0a5a8c", a: "#4cc2ff", p: "wave" },
};
function gtOff() { try { return localStorage.gt_off === "1" } catch { return false } }
function gtSlug() {
  const h = location.hash || ""; let m = h.match(/^#\/catalog\?.*?\bgame=([a-z0-9-]+)/); if (m) return m[1];
  const el = document.querySelector(".lot[data-game]"); if (/^#\/l\//.test(h) && el) return el.dataset.game; return "";
}
function gtApply() {
  const s = gtSlug(), t = GT[s], b = document.body;
  let st = document.getElementById("gts"); if (!st) { st = document.createElement("style"); st.id = "gts"; document.head.append(st) }
  if (!s || gtOff()) { b.removeAttribute("data-gt"); st.textContent = ""; return }
  // игра без своей темы — нейтральная подсветка фирменным цветом сайта
  const T = t || { bg: "#0c0a18", g: "#2a1a5a", a: "#a78bfa", p: "hex" }, light = document.documentElement.style.getPropertyValue("--bg").trim().toLowerCase() === "#f4f4f8";
  b.setAttribute("data-gt", s);
  st.textContent = `body[data-gt]::before{content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;background:${PAT[T.p](T.a)} 0 0/auto,radial-gradient(1000px 520px at 85% -8%,${T.g},transparent 70%),radial-gradient(800px 500px at 0% 105%,${T.g}aa,transparent 70%),linear-gradient(180deg,${T.bg},${T.bg});opacity:${light ? .16 : 1}}body[data-gt]{background:transparent!important}html{background:var(--bg)}body[data-gt] .rw,body[data-gt] .card{border-color:color-mix(in srgb,${T.a} 28%,var(--b))}body[data-gt] .gtb{border-color:${T.a};color:${T.a}}`;
}
const gtToggle = () => { try { localStorage.gt_off = gtOff() ? "0" : "1" } catch { } gtApply(); const e = document.getElementById("gtt"); if (e) e.textContent = gtOff() ? "Включить тему игры" : "Выключить тему игры" };
// ---- закреп выгодного продавца
async function pinLoad() {
  const box = document.getElementById("pinbox"); if (!box) return; const g = F.game; if (!g) { box.innerHTML = ""; return }
  try {
    const p = await api("/pins?" + new URLSearchParams({ game: g, category: F.category || "" })); if (!p) { box.innerHTML = ""; return }
    const left = Math.max(0, new Date(p.ends_at) - Date.now()), hh = Math.floor(left / 3600000), mm = Math.floor(left % 3600000 / 60000);
    box.innerHTML = `<div class="pinb"><div class="row bet"><b><span class="pinl">Закреплено · выгодная цена</span></b><small class="m">до смены: ${hh ? hh + " ч " : ""}${mm} мин</small></div><p class="m" style="margin:4px 0 8px">Магазин <a class="lk" onclick="go('/u/'+encodeURIComponent('${esc(p.seller)}'))">${esc(p.seller)}</a> предлагает лучшие цены в этом разделе. Подборка обновляется автоматически.</p>${rows(p.listings, "")}</div>`;
  } catch { box.innerHTML = "" }
}
const _cat5 = catalog;
catalog = async function () {
  let h = await _cat5.apply(this, arguments);
  if (F.game) { h = h.replace('<div id="rl">', '<div id="pinbox"></div><div id="rl">'); h = h.replace("</h1>", `</h1><a id="gtt" class="gtt" onclick="gtToggle()">${gtOff() ? "Включить тему игры" : "Выключить тему игры"}</a>`) }
  return h;
};
const ar5 = window.afterRoute; window.afterRoute = function () { const r = ar5 && ar5.apply(this, arguments); setTimeout(() => { gtApply(); pinLoad(); const t = document.querySelector("#fp"); }, 30); return r };
window.addEventListener("hashchange", () => setTimeout(gtApply, 80));
