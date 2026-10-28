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
  const AI = ["Android", "iOS"], PC = ["ПК", "PlayStation", "Xbox", "Switch"];
  const PLATS = { "fortnite": [...PC, ...AI], "genshin": [...AI, "ПК", "PlayStation"], "hsr": [...AI, "ПК", "PlayStation"], "brawl-stars": AI, "pubg-mobile": AI, "free-fire": AI, "mobile-legends": AI, "roblox": [...AI, "ПК", "Xbox", "PlayStation"], "apex-legends": PC, "minecraft": [...AI, ...PC], "valorant": null };
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

  // ---- форма объявления: пакет и платформа вместо «Название валюты» и «Сервер / платформа»
  let tok = 0;
  function tidy() { // валюта известна по игре, поэтому лишние поля убираем
    ["unit", "server"].forEach(k => document.querySelectorAll('[data-a="' + k + '"]').forEach(inp => { if (inp.closest("#qtyb")) return; const lb = inp.previousElementSibling; if (lb && lb.tagName === "LABEL") lb.remove(); inp.remove() }));
    document.querySelectorAll(".lsec").forEach(h => { if (!/Параметры/.test(h.textContent)) return; let n = h.nextElementSibling, empty = true; while (n && !n.classList.contains("lsec")) { if (n.matches("label,input,select,textarea,.hint,[data-a]") ) { empty = false; break } n = n.nextElementSibling } if (empty) h.remove() });
  }
  async function qtyMount() {
    const sg = document.getElementById("sg"), sc = document.getElementById("sc"), st = document.getElementById("st");
    if (!sg || !sc || !st) return;
    const my = ++tok, pk = packsFor(sg.value, sc.value), old = document.getElementById("qtyb"), key = sg.value + "|" + sc.value;
    if (!pk) { old && old.remove(); return }
    if (old && old.dataset.k === key) { tidy(); return }
    let cur = old ? (old.querySelector('[data-a="qty"]') || {}).value : "", plat = old ? (old.querySelector('[data-a="platform"]') || {}).value : "";
    const em = /^#\/edit\/(.+)$/.exec(location.hash.split("?")[0]);
    if (!old && em) { try { const l = await api("/listings/" + em[1]); const a = l.attrs || {}; cur = a.qty || ""; plat = a.platform || ""; if (!plat && a.server) { const f = (PLATS[sg.value] || []).find(x => new RegExp(x, "i").test(a.server)); plat = f || "" } } catch { } if (my !== tok) return }
    document.getElementById("qtyb")?.remove();
    const pl = PLATS[sg.value];
    const box = document.createElement("div"); box.id = "qtyb"; box.dataset.k = key;
    box.innerHTML = `<label>Количество ${E(pk.u)} в одном пакете</label><select data-a="qty"><option value="">Не указано</option>${pk.p.map(n => `<option value="${n}" ${String(n) === String(cur) ? "selected" : ""}>${fmt(n)} ${E(pk.u)}</option>`).join("")}</select><div class="hint">Покупатели найдут лот в каталоге по этому количеству</div>${pl ? `<label>Платформа</label><select data-a="platform"><option value="">Любая</option>${pl.map(x => `<option ${x === plat ? "selected" : ""}>${E(x)}</option>`).join("")}</select>` : ""}<input type="hidden" data-a="unit" value="${E(pk.u)}">`;
    const anchor = st.nextElementSibling && st.nextElementSibling.classList.contains("hint") ? st.nextElementSibling : st; anchor.insertAdjacentElement("afterend", box);
    tidy();
  }
  document.addEventListener("input", e => { if (e.target && (e.target.id === "sg" || e.target.id === "sc")) setTimeout(qtyMount, 30) });
  document.addEventListener("change", e => { if (e.target && (e.target.id === "sg" || e.target.id === "sc")) setTimeout(qtyMount, 30) });
  const ar = window.afterRoute;
  window.afterRoute = function () { const r = ar && ar.apply(this, arguments); setTimeout(qtyMount, 60); setTimeout(qtyMount, 400); return r };
})();

// ================= v21: карточка заказа для персонала и разделы «актуальные / неактуальные» =================
(function () {
  "use strict";
  const E = s => (typeof esc === "function" ? esc(s) : String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));
  const $$ = (q, r) => [...(r || document).querySelectorAll(q)];
  const OST = { pending_payment: "Ожидает оплаты", paid: "Оплачен", in_progress: "В работе", completed: "Завершён", cancelled: "Отменён", dispute: "Открыт спор" };
  const PST = { not_configured: "не настроена", pending: "ожидается", confirmed: "подтверждена", failed: "ошибка", refunded: "возвращена" };
  const DS = { open: "Открыт", in_review: "Рассматривается", awaiting_info: "Нужна информация", resolved_buyer: "Решён в пользу покупателя", resolved_seller: "Решён в пользу продавца", closed: "Закрыт" };
  const dt = iso => new Date(iso).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  window.staffOrder = async function (id) {
    const o = await api("/admin/orders/" + id), rub2 = c => (c / 100).toLocaleString("ru-RU") + " ₽";
    const pu = n => `<a class="lk" onclick="go('/u/'+encodeURIComponent('${E(n)}'))">${E(n)}</a>`;
    return `<div class="row bet" style="margin:12px 0"><a class="bk" onclick="history.back()" aria-label="Назад">‹</a><h2 style="margin:0;flex:1">Заказ #${E(o.number)}</h2><span class="tag">${E(OST[o.status] || o.status)}</span></div>
<div class="card"><b style="overflow-wrap:anywhere">${E(o.title)}</b><div class="m">${E(o.game_name)} · ${E(o.category_name)}</div>
<div class="kv" style="margin-top:10px"><div><small>Сумма</small>${rub2(o.total_cents)}</div><div><small>Количество</small>${o.quantity} шт.</div><div><small>Оплата</small>${E(PST[o.payment_status] || o.payment_status)}</div><div><small>Комиссия</small>${rub2(o.fee_cents || 0)}</div><div><small>Покупатель</small>${pu(o.buyer)}</div><div><small>Продавец</small>${pu(o.seller)}</div><div><small>Создан</small>${dt(o.created_at)}</div></div>
${o.hold ? `<p class="m" style="margin:10px 0 0">Деньги продавца: ${o.hold.status === "held" ? "заморожено " + (o.hold.amount).toLocaleString("ru-RU") + " ₽ до решения по спору" : o.hold.status === "captured" ? "списано в пользу покупателя" : "заморозка снята"}.</p>` : ""}</div>
${o.disputes.length ? `<h3>Споры</h3>${o.disputes.map(d => `<div class="card"><div class="row bet"><span style="overflow-wrap:anywhere">${E(d.reason.slice(0, 120))}</span><span class="tag">${E(DS[d.status] || d.status)}</span></div></div>`).join("")}` : ""}
<h3>История</h3><div class="card">${o.events.map(e => `<div class="row bet"><span>${E(OST[e.status] || e.status)}${e.username ? ` <small class="m">${E(e.username)}</small>` : ""}</span><small class="m">${dt(e.created_at)}</small></div>`).join("") || '<span class="m">Событий нет.</span>'}</div>
<h3>Переписка покупателя и продавца</h3>${o.messages.map(m => m.kind === "system" ? `<div class="m" style="margin:6px 0"><small>Система · ${dt(m.created_at)}</small><br>${E(m.body)}</div>` : `<div style="margin:6px 0;overflow-wrap:anywhere"><b>${E(m.username || "?")}</b> <small class="m">${dt(m.created_at)}</small><br>${m.body === "[вложение]" ? '<span class="m">вложение</span>' : E(m.body)}</div>`).join("") || '<p class="m">Переписки нет.</p>'}`;
  };

  // разделы: актуальные / неактуальные
  const ACTIVE = new Set(["open", "in_review", "awaiting_info", "new", "awaiting_user", "Открыт", "Рассматривается", "Нужна информация", "Новое", "Ожидает ответа"]);
  window._sec = window._sec || {};
  function sections(key, cards, before) {
    cards = cards.filter(c => c.querySelector(".tag")); if (!cards.length) return;
    if (document.querySelector('.secb[data-k="' + key + '"]')) return;
    const cnt = { a: 0, n: 0 };
    cards.forEach(c => { const t = c.querySelector(".tag"), raw = t.textContent.trim(); if (DS[raw]) t.textContent = DS[raw]; const g = ACTIVE.has(raw) ? "a" : "n"; c.dataset.sg = g; cnt[g]++ });
    const bar = document.createElement("div"); bar.className = "tabs admf secb"; bar.dataset.k = key;
    bar.innerHTML = `<button data-f="a">Актуальные <small>${cnt.a}</small></button><button data-f="n">Неактуальные <small>${cnt.n}</small></button><button data-f="all">Все <small>${cards.length}</small></button>`;
    const apply = f => { window._sec[key] = f; bar.querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.f === f)); cards.forEach(c => { c.style.display = (f === "all" || c.dataset.sg === f) ? "" : "none" }) };
    bar.addEventListener("click", e => { const b = e.target.closest("button"); if (b) apply(b.dataset.f) });
    (before || cards[0]).insertAdjacentElement("beforebegin", bar);
    apply(window._sec[key] || (cnt.a ? "a" : "all"));
  }
  function decorate() {
    const h = location.hash;
    if (/^#\/admin/.test(h)) {
      const tab = new URLSearchParams(h.split("?")[1] || "").get("tab") || "listings";
      if (tab === "disputes" || tab === "tickets") sections("adm-" + tab, $$("#app > .card.row"));
    } else if (/^#\/tickets\/?(\?|$)/.test(h) && !/new=1/.test(h)) {
      const app = document.getElementById("app"); if (!app) return;
      $$("h2", app).forEach(hd => { const key = "u-" + hd.textContent.trim(); if (!/^Мои (обращения|споры)/.test(hd.textContent.trim())) return; const cards = []; let n = hd.nextElementSibling; while (n && n.tagName !== "H2") { if (n.classList.contains("card") && n.querySelector(".tag")) cards.push(n); n = n.nextElementSibling } sections(key, cards, cards[0]) });
    }
  }
  const ar2 = window.afterRoute;
  window.afterRoute = function () { const r = ar2 && ar2.apply(this, arguments); decorate(); setTimeout(decorate, 150); return r };
})();
