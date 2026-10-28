// v19: быстрый выбор пакета доната (1000 В-баксов и т.д.) в каталоге и в форме объявления
(function () {
  "use strict";
  // Размеры пакетов сверены с витринами и официальными страницами (см. v19-что-заменить.txt). Для остальных игр быстрый фильтр не показывается.
  const PACKS = {
    "fortnite": { u: "В-баксов", p: [800, 1000, 2400, 2800, 4500, 5000, 12500, 13500] },
    "genshin": { u: "кристаллов", p: [60, 330, 1090, 2240, 3880, 8080] },
    "hsr": { u: "осколков", p: [60, 330, 1090, 2240, 3880, 8080] },
    "brawl-stars": { u: "гемов", p: [30, 80, 170, 360, 950, 2000] },
    "pubg-mobile": { u: "UC", p: [60, 325, 660, 1800, 3850, 8100, 16200] },
    "valorant": { u: "VP", p: [475, 1000, 2050, 3650, 5350, 11000] },
    "roblox": { u: "Robux", p: [400, 800, 1700, 4500, 10000, 22500] },
    "free-fire": { u: "алмазов", p: [100, 210, 310, 520, 530, 1060, 1080, 2180, 2200, 5600] },
    "mobile-legends": { u: "алмазов", p: [56, 278, 571, 1167, 1783, 3005, 4770, 6012] },
    "apex-legends": { u: "монет", p: [1000, 1100, 2150, 4350, 6700, 11500] },
    "minecraft": { u: "Minecoins", p: [320, 1020, 1720, 3500] }
  };
  const CATS_OK = ["currency", "donat"];
  const E = s => (typeof esc === "function" ? esc(s) : String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));
  const fmt = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const packsFor = (g, c) => (PACKS[g] && CATS_OK.includes(c)) ? PACKS[g] : null;
  window.packsFor = packsFor;
  try { if (typeof LBL === "object") LBL.qty = "Количество" } catch { }

  // ---- каталог: ряд кнопок «1000 · 2800 · 5000 ...» под категориями
  window.qtySet = function (n) { if (typeof F === "undefined") return; if (n) F.qty = String(n); else delete F.qty; go("/catalog?" + qs()) };
  const _cat = catalog;
  catalog = async function () {
    if (typeof F !== "undefined" && F.qty && !packsFor(F.game, F.category)) delete F.qty;
    let h = await _cat.apply(this, arguments);
    const pk = packsFor(F.game, F.category); if (!pk) return h;
    const cur = F.qty || "";
    const row = `<div class="qtyb"><div class="qtyh">Количество ${E(pk.u)}</div><div class="chips scr qtyc"><a class="${cur ? "" : "on"}" onclick="qtySet('')">Любое</a>${pk.p.map(n => `<a class="${String(n) === cur ? "on" : ""}" onclick="qtySet(${n})">${fmt(n)}</a>`).join("")}</div></div>`;
    const i = h.indexOf('<div class="cbar">'); return i < 0 ? h : h.slice(0, i) + row + h.slice(i);
  };

  // ---- форма объявления: выбор пакета (попадает в характеристики как «Количество»)
  let tok = 0;
  async function qtyMount() {
    const sg = document.getElementById("sg"), sc = document.getElementById("sc"), st = document.getElementById("st");
    if (!sg || !sc || !st || !document.querySelector("#st")) return;
    const my = ++tok, pk = packsFor(sg.value, sc.value), old = document.getElementById("qtyb");
    if (!pk) { old && old.remove(); return }
    let sel = old && old.dataset.k === sg.value + "|" + sc.value ? old : null; if (sel) return;
    let cur = old ? (old.querySelector("select") || {}).value : "";
    const em = /^#\/edit\/(.+)$/.exec(location.hash.split("?")[0]);
    if (!old && em) { try { const l = await api("/listings/" + em[1]); cur = (l.attrs && l.attrs.qty) || "" } catch { } if (my !== tok) return }
    document.getElementById("qtyb")?.remove();
    const box = document.createElement("div"); box.id = "qtyb"; box.dataset.k = sg.value + "|" + sc.value;
    box.innerHTML = `<label>Количество ${E(pk.u)} в одном пакете</label><select data-a="qty"><option value="">Не указано</option>${pk.p.map(n => `<option value="${n}" ${String(n) === String(cur) ? "selected" : ""}>${fmt(n)} ${E(pk.u)}</option>`).join("")}</select><div class="hint">Покупатели смогут найти ваш лот в каталоге по этому количеству</div>`;
    const anchor = st.nextElementSibling && st.nextElementSibling.classList.contains("hint") ? st.nextElementSibling : st; anchor.insertAdjacentElement("afterend", box);
  }
  document.addEventListener("input", e => { if (e.target && (e.target.id === "sg" || e.target.id === "sc")) setTimeout(qtyMount, 30) });
  document.addEventListener("change", e => { if (e.target && (e.target.id === "sg" || e.target.id === "sc")) setTimeout(qtyMount, 30) });
  const ar = window.afterRoute;
  window.afterRoute = function () { const r = ar && ar.apply(this, arguments); setTimeout(qtyMount, 60); setTimeout(qtyMount, 400); return r };
})();
