// v17: экран блокировки, последний визит и онлайн без перезагрузки, встроенная клавиатура чата, счётчики и фильтры админки,
// звёзды рейтинга и отзыва, что смотрит покупатель, профиль по играм и категориям, поиск соперника в дуэлях
(function () {
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const E = s => (typeof esc === "function" ? esc(s) : String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));
  const safe = f => (...a) => { try { return f(...a) } catch (e) { console.error(e) } };

  // ======================= Экран блокировки аккаунта =======================
  let lockTimer = null;
  function lockHide() { clearInterval(lockTimer); document.getElementById("lockscr")?.remove(); document.body.classList.remove("locked") }
  function lockShow(u) {
    const until = new Date(u.blocked_until); if (!(until > new Date())) return lockHide();
    document.body.classList.add("locked");
    let box = document.getElementById("lockscr");
    if (!box) {
      box = document.createElement("div"); box.id = "lockscr";
      const dn = (n, st) => `<span class="lkd" style="${st}">${typeof logo === "function" ? logo(n) : ""}</span>`;
      box.innerHTML = `<div class="lkbg">${dn(260, "left:-70px;top:7%;--r:-14deg;--d:0s")}${dn(180, "right:-40px;top:20%;--r:18deg;--d:1.2s")}${dn(320, "left:50%;bottom:-120px;margin-left:-160px;--r:8deg;--d:.6s")}${dn(120, "left:8%;bottom:22%;--r:-30deg;--d:2s")}${dn(150, "right:10%;bottom:8%;--r:25deg;--d:1.6s")}</div>
<div class="lkc"><div class="lkl">${typeof logo === "function" ? logo(54) : ""}<b>Donut<i>Pay</i></b></div><h1>Аккаунт заблокирован</h1>
<div class="lkr"><small>Ник</small><b id="lkn"></b></div><div class="lkr"><small>Причина блокировки</small><div id="lkre"></div></div>
<div class="lkr"><small>Блокировка на</small><b id="lkdur"></b></div><div class="lkr big"><small>До разблокировки</small><b id="lkt">--</b></div><div class="lkr"><small>Разблокируют</small><b id="lku"></b></div>
<p class="m">Пока блокировка не закончится, пользоваться сайтом нельзя. Если считаете её ошибочной, напишите в поддержку после разблокировки.</p><button class="btn" onclick="logout()">Выйти из аккаунта</button></div>`;
      document.body.append(box);
    }
    document.getElementById("lkn").textContent = u.username || ""; document.getElementById("lkre").textContent = u.block_reason || "Причина не указана";
    document.getElementById("lku").textContent = until.toLocaleString("ru-RU", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
    const bh = +u.block_hours || Math.ceil((until - Date.now()) / 36e5), days = Math.floor(bh / 24), rest = bh % 24;
    document.getElementById("lkdur").textContent = bh >= 48 ? days + " дн" + (rest ? " " + rest + " ч" : "") : bh + " ч";
    clearInterval(lockTimer);
    const tick = () => { const s = Math.max(0, Math.floor((until - Date.now()) / 1000)); if (s <= 0) { lockHide(); location.reload(); return } const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60, p = n => String(n).padStart(2, "0"); const t = document.getElementById("lkt"); if (t) t.textContent = (d ? d + " д " : "") + p(h) + ":" + p(m) + ":" + p(ss) };
    tick(); lockTimer = setInterval(tick, 1000);
  }
  async function lockCheck() { try { const r = await fetch("/api/me", { credentials: "same-origin" }); if (!r.ok) return; const u = await r.json(); if (u.blocked_until && new Date(u.blocked_until) > new Date()) lockShow(u); else lockHide() } catch { } }
  window.lockCheck = lockCheck;
  if (typeof api === "function") { const _api = api; api = async function () { try { return await _api.apply(this, arguments) } catch (e) { if (/account blocked|заблокирован/i.test(e && e.message || "")) lockCheck(); throw e } } }
  setInterval(() => { if (typeof ME !== "undefined" && ME) lockCheck() }, 60000);

  // ======================= Последний визит и онлайн без перезагрузки =======================
  async function seenFill() {
    const els = $$("[data-seen]"); if (!els.length) return;
    const names = [...new Set(els.map(e => e.dataset.seen).filter(Boolean))].slice(0, 40); if (!names.length) return;
    try {
      const r = await fetch("/api/lastseen?names=" + encodeURIComponent(names.join(",")), { credentials: "same-origin" }); if (!r.ok) return; const d = await r.json(); Object.assign(window._seen, d);
      els.forEach(e => { const x = d[e.dataset.seen]; if (!x) return; const on = !!x.on; e.textContent = on ? (e.dataset.onl || "Онлайн") : seenAgo(x.at); e.classList.toggle("on-s", on); e.classList.toggle("m", !on) });
    } catch { }
  }
  setInterval(seenFill, 15000);
  // «прочитано»: собеседник открыл диалог, галочки обновляются сразу
  function markRead(cid) { if (typeof CC !== "undefined" && cid && CC !== cid) return; $$("#chm .bb.me .ck:not(.rd)").forEach(s => { s.classList.add("rd"); s.insertAdjacentHTML("beforeend", '<path d="M8 10.5l1.5 1L17 3"/>') }) }
  function hookStream() { if (typeof ES === "undefined" || !ES || ES._v17) return; ES._v17 = 1; ES.addEventListener("read", e => { try { const d = JSON.parse(e.data); markRead(d.conversation_id) } catch { } }) }
  if (typeof afterLogin === "function") { const _al = afterLogin; afterLogin = async function () { const r = await _al.apply(this, arguments); hookStream(); lockCheck(); return r } }
  setInterval(hookStream, 4000);

  // ======================= Что смотрит собеседник (вместо «По лоту») =======================
  let vwTimer = null, vwSent = null;
  async function vwSend(id) { if (vwSent === id) return; vwSent = id; try { await fetch("/api/viewing", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ listingId: id }) }) } catch { } }
  async function vwFill() {
    const bar = document.getElementById("vwb"); if (!bar) return; const name = window.CHO; if (!name) return;
    try {
      const r = await fetch("/api/viewing?username=" + encodeURIComponent(name), { credentials: "same-origin" }); if (!r.ok) return; const d = await r.json();
      const l = d.live || d.last; if (!l) { bar.style.display = "none"; return }
      bar.style.display = ""; bar.innerHTML = `<span class="vwi${d.live ? " on" : ""}"></span><span class="vwt">${d.live ? "Сейчас смотрит" : "Писал по лоту"}</span><a onclick="go('/l/${l.id}')">${E(l.title)}</a>`;
    } catch { }
  }
  function vwMount() {
    const head = document.querySelector(".mc2 .chh2"); if (!head || document.getElementById("vwb")) return;
    head.insertAdjacentHTML("afterend", '<div id="vwb" class="vwb" style="display:none"></div>'); vwFill(); clearInterval(vwTimer); vwTimer = setInterval(() => { if (!document.getElementById("vwb")) return clearInterval(vwTimer); vwFill() }, 12000);
  }

  // ======================= Звёзды: компонент и форма отзыва =======================
  window.ratingStars = function (v, n) {
    v = +v || 0; return `<span class="rs5" title="${v}">${[0, 1, 2, 3, 4].map(i => `<i style="--f:${Math.round(Math.max(0, Math.min(1, v - i)) * 100)}%"></i>`).join("")}<b>${v.toFixed(1).replace(/\.0$/, "")}</b>${n != null ? `<small class="m">${n} отз.</small>` : ""}</span>`;
  };
  const RLBL = ["", "Ужасно", "Плохо", "Нормально", "Хорошо", "Отлично"];
  window.revStar = n => { window._rvn = n; $$("#rvst button").forEach((b, i) => b.classList.toggle("on", i < n)); const l = document.getElementById("rvl"); if (l) l.textContent = RLBL[n] || "Выберите оценку" };
  window.revForm = function (id, edit) {
    const r = edit ? window._rv : null; window._rvn = r ? r.rating : 0;
    mdl(`<h3 style="margin:0 0 4px">${edit ? "Изменить отзыв" : "Оставить отзыв"}</h3><p class="m" style="margin:0 0 12px">Нажмите на звезду, чтобы поставить оценку.</p>
<div id="rvst" class="rvst">${[1, 2, 3, 4, 5].map(i => `<button type="button" class="${i <= window._rvn ? "on" : ""}" onclick="revStar(${i})" aria-label="${i} из 5"><svg viewBox="0 0 24 24"><path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 17.8 5.8 21.100 7 14.200 2 9.300l6.900-1z"/></svg></button>`).join("")}</div>
<div id="rvl" class="rvl">${RLBL[window._rvn] || "Выберите оценку"}</div>
<label>Комментарий (необязательно)</label><textarea id="rvb" rows="4" maxlength="1000" placeholder="Как всё прошло? Что понравилось?">${E(r ? r.body || "" : "")}</textarea>
<button class="btn pri big" style="width:100%;margin-top:12px" onclick="revSend('${id}',${edit ? 1 : 0})">${edit ? "Сохранить" : "Отправить отзыв"}</button>`);
  };
  window.revSend = act(async (id, edit) => {
    const n = window._rvn; if (!n) throw new Error("Поставьте оценку, нажав на звезду");
    await api(`/orders/${id}/review`, { method: edit ? "PATCH" : "POST", body: { rating: n, body: ($("#rvb").value || "").trim() } }); $("#md")?.remove(); toast(edit ? "Отзыв изменён" : "Спасибо за отзыв"); route();
  });

  // ======================= Админка: счётчики на вкладках и фильтры =======================
  const GROUPS = {
    orders: { a: ["Ожидает оплаты", "Оплачен", "Открыт спор"], p: ["В работе"], n: ["Завершён", "Отменён"] },
    disputes: { a: ["open"], p: ["in_review", "awaiting_info"], n: ["resolved_buyer", "resolved_seller", "closed"] },
    tickets: { a: ["Новое"], p: ["Рассматривается", "Ожидает ответа"], n: ["Решено", "Закрыто"] },
    withdrawals: { a: ["Ожидает"], p: ["В обработке"], n: ["Выплачено", "Отклонено"] },
    promos: { a: ["Включён"], p: [], n: ["Выключен"] },
    users: { a: ["__ok"], p: [], n: ["__blocked"] }
  };
  const cardGroup = (tab, card) => {
    const g = GROUPS[tab]; if (!g) return "a";
    if (tab === "users") return /заблокирован до/.test(card.textContent) ? "n" : "a";
    const tag = (card.querySelector(".tag:last-of-type") || card.querySelector(".tag")); const t = tag ? tag.textContent.trim() : "";
    for (const k of ["a", "p", "n"]) if (g[k].includes(t)) return k;
    return "a";
  };
  window.admFilter = function (k) {
    window._admf = k; const tab = new URLSearchParams(location.hash.split("?")[1] || "").get("tab") || "listings";
    $$("#admf button").forEach(b => b.classList.toggle("on", b.dataset.k === k));
    $$("#app > .card").forEach(c => { if (c.dataset.nofilter) return; c.style.display = (k === "all" || cardGroup(tab, c) === k) ? "" : "none" });
  };
  async function admDecorate() {
    if (!/^#\/admin/.test(location.hash)) return; const tab = new URLSearchParams(location.hash.split("?")[1] || "").get("tab") || "listings";
    const tabs = document.querySelector("#app .tabs"); if (!tabs || tabs.dataset.v17) return; tabs.dataset.v17 = 1;
    try {
      const c = await api("/admin/counts");
      $$("a", tabs).forEach(a => { const m = /tab=([a-z]+)/.exec(a.getAttribute("onclick") || ""); if (!m) return; const n = c[m[1]]; if (n > 0) a.insertAdjacentHTML("beforeend", `<b class="tbn">${n}</b>`) });
      if (tab === "listings") $$("#app .tabs ~ .tabs a").forEach(a => { const m = /st=([a-z]+)/.exec(a.getAttribute("onclick") || ""); if (m && m[1] === "pending" && c.listings > 0) a.insertAdjacentHTML("beforeend", `<b class="tbn">${c.listings}</b>`); });
    } catch { }
    if (GROUPS[tab]) {
      const cards = $$("#app > .card"), cnt = { a: 0, p: 0, n: 0 }; cards.forEach(cd => { cnt[cardGroup(tab, cd)]++ });
      const lab = tab === "users" ? ["Актуальные", "", "Неактуальные"] : ["Актуальные", "В процессе", "Неактуальные"];
      const bar = `<div id="admf" class="tabs admf"><button data-k="all" onclick="admFilter('all')">Все</button><button data-k="a" onclick="admFilter('a')">${lab[0]} <small>${cnt.a}</small></button>${tab === "users" || tab === "promos" ? "" : `<button data-k="p" onclick="admFilter('p')">${lab[1]} <small>${cnt.p}</small></button>`}<button data-k="n" onclick="admFilter('n')">${lab[2]} <small>${cnt.n}</small></button></div>`;
      const anchor = document.querySelector("#app .tabs"); if (anchor && !document.getElementById("admf")) { const first = cards[0]; (first ? first : anchor).insertAdjacentHTML(first ? "beforebegin" : "afterend", bar) }
      const k = window._admf && ["all", "a", "p", "n"].includes(window._admf) ? window._admf : (cnt.a ? "a" : "all"); admFilter(k);
    }
    if (tab === "listings") $$("#app .tabs ~ .tabs a").forEach(a => { const t = a.textContent; a.textContent = t.replace("На модерации", "Актуальные: на проверке").replace("Опубликовано", "Опубликованы").replace("Отклонено", "Неактуальные: скрытые").replace("В архиве", "Неактуальные: удалённые") });
  }

  // ======================= Профиль: лоты по играм и категориям =======================
  function groupLots() {
    if (!/^#\/(u|shop)\//.test(location.hash)) return; const rows = document.querySelector("#app .rows"); if (!rows || rows.dataset.g) return;
    const items = [...rows.children]; if (items.length < 2) return; rows.dataset.g = 1;
    const key = el => { const t = [...el.querySelectorAll(".rtags span")].map(x => x.textContent.trim()).filter(Boolean); return t.length >= 2 ? [t[0], t[1]] : [t[0] || "Другое", "Все лоты"] };
    const by = new Map(); items.forEach(el => { const [g, c] = key(el); if (!by.has(g)) by.set(g, new Map()); const cm = by.get(g); if (!cm.has(c)) cm.set(c, []); cm.get(c).push(el) });
    if (by.size === 1 && [...by.values()][0].size === 1) { return }
    const frag = document.createElement("div"); frag.className = "lgp";
    for (const [g, cm] of by) {
      const sec = document.createElement("div"); sec.className = "lgg"; sec.innerHTML = `<h3 class="lgh">${E(g)}</h3>`;
      for (const [c, els] of cm) { const cat = document.createElement("div"); cat.innerHTML = `<div class="lgc">${E(c)} <small>${els.length}</small></div>`; const box = document.createElement("div"); box.className = "rows"; els.forEach(e => box.append(e)); cat.append(box); sec.append(cat) }
      frag.append(sec);
    }
    rows.replaceWith(frag);
  }

  // ======================= Дуэли: кто ищет соперника =======================
  window._dq = window._dq || [];
  const dqHtml = () => {
    const q = window._dq || [], ago = iso => { const m = Math.max(0, Math.floor((Date.now() - new Date(iso)) / 60000)); return m < 1 ? "только что" : m < 60 ? m + " мин" : Math.floor(m / 60) + " ч" };
    return `<h3>Ищут соперника</h3>${q.map(x => `<div class="card dqc"><div class="row bet" style="flex-wrap:nowrap"><span style="min-width:0"><b>${E(x.username)}</b> <small class="m">рейтинг ${x.rating}</small><br><small class="m">${E(x.game_name)} · ${E(x.category_name)} · ищет ${ago(x.since)}</small></span>${x.mine ? '<span class="tag">Это вы</span>' : x.can_join ? `<button class="btn sm pri" onclick="duelJoin('${x.user_id}')">Принять вызов</button>` : `<span class="m" style="text-align:right"><small>${typeof ME === "undefined" || !ME ? "Войдите" : "Нужен лот в этой категории"}</small></span>`}</div></div>`).join("") || '<div class="card m">Сейчас никто не ищет соперника. Нажмите «Искать соперника» выше, и ваша заявка появится здесь для других продавцов.</div>'}`;
  };
  window.duelJoin = act(async id => { const r = await api("/duels/join", { method: "POST", body: { userId: id } }); toast("Дуэль началась"); route() });
  if (typeof duelBody === "function") { const _db = duelBody; duelBody = function (d) { const h = _db.apply(this, arguments); const i = h.indexOf("<h3>Идут сейчас</h3>"); return i < 0 ? h + dqHtml() : h.slice(0, i) + dqHtml() + h.slice(i) } }
  if (typeof battlesPage === "function") {
    const _bp = battlesPage;
    battlesPage = async function () {
      window._dq = await api("/duels/queue").catch(() => []); const h = await _bp.apply(this, arguments); clearInterval(window._dq2);
      window._dq2 = setInterval(async () => { if (!/^#\/battles/.test(location.hash)) return clearInterval(window._dq2); try { window._dq = await api("/duels/queue") } catch { } }, 8000); return h;
    };
  }

  // ======================= Встроенная клавиатура чата =======================
  const KB = { ru: [["й", "ц", "у", "к", "е", "н", "г", "ш", "щ", "з", "х", "ъ"], ["ф", "ы", "в", "а", "п", "р", "о", "л", "д", "ж", "э"], ["⇧", "я", "ч", "с", "м", "и", "т", "ь", "б", "ю", "ё", "⌫"]], en: [["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"], ["a", "s", "d", "f", "g", "h", "j", "k", "l"], ["⇧", "z", "x", "c", "v", "b", "n", "m", "⌫"]], sym: [["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"], ["-", "/", ":", ";", "(", ")", "₽", "&", "@", '"'], ["#", "%", "+", "=", "?", "!", "'", "*", "⌫"]] };
  let kbMode = "sys", lay = "ru", shift = false, tgt = null, kbEl = null, rep = null;
  try { kbMode = localStorage.getItem("dp_kb") || (matchMedia("(pointer:coarse)").matches ? "own" : "sys") } catch { kbMode = matchMedia("(pointer:coarse)").matches ? "own" : "sys" }
  const MANAGED = el => el && (el.id === "lt" || el.id === "otm");
  function kbRender() {
    if (!kbEl) return;
    const rows = KB[lay].map(r => `<div class="kr">${r.map(k => `<button type="button" class="k ${k === "⇧" ? "kf" + (shift ? " on" : "") : k === "⌫" ? "kf" : ""}" data-k="${k}">${k === "⌫" ? '<svg width="22" height="16" viewBox="0 0 24 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M8 1h13a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H8L1 9z"/><path d="M13 6l6 6M19 6l-6 6"/></svg>' : k === "⇧" ? "⇧" : (shift && lay !== "sym" ? k.toUpperCase() : k)}</button>`).join("")}</div>`).join("");
    kbEl.querySelector(".kbody").innerHTML = rows + `<div class="kr"><button type="button" class="k kf kw" data-k="__sym">${lay === "sym" ? "АБВ" : "?123"}</button><button type="button" class="k kf" data-k="__lang">${lay === "ru" ? "RU" : lay === "en" ? "EN" : lay.toUpperCase()}</button><button type="button" class="k ksp" data-k=" ">Пробел</button><button type="button" class="k" data-k=".">.</button><button type="button" class="k" data-k=",">,</button><button type="button" class="k kf ksend" data-k="__send" aria-label="Отправить"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button></div>`;
  }
  function kbMount() {
    if (kbEl) return;
    kbEl = document.createElement("div"); kbEl.id = "dkb";
    kbEl.innerHTML = `<div class="ktop"><span>Клавиатура DonutPay</span><span><button type="button" class="kt" data-k="__sys">Системная</button><button type="button" class="kt" data-k="__hide" aria-label="Скрыть">Скрыть</button></span></div><div class="kbody"></div>`;
    document.body.append(kbEl); kbRender();
    kbEl.addEventListener("pointerdown", e => { const b = e.target.closest("button"); if (!b) return; e.preventDefault(); press(b.dataset.k); if (b.dataset.k === "⌫") { clearTimeout(rep); rep = setTimeout(function loop() { press("⌫"); rep = setTimeout(loop, 55) }, 380) } });
    const stop = () => { clearTimeout(rep) }; document.addEventListener("pointerup", stop); document.addEventListener("pointercancel", stop);
    kbEl.addEventListener("contextmenu", e => e.preventDefault());
  }
  function kbShow() { if (kbMode !== "own") return; kbMount(); kbEl.classList.add("on"); document.body.classList.add("ckb"); const h = kbEl.offsetHeight; document.documentElement.style.setProperty("--ckh", h + "px"); window.dispatchEvent(new Event("resize")); const m = document.getElementById("chm") || document.getElementById("otl"); if (m) m.scrollTop = 1e9; if (tgt && tgt.id === "otm") setTimeout(() => tgt.scrollIntoView({ block: "center" }), 50) }
  function kbHide() { kbEl && kbEl.classList.remove("on"); document.body.classList.remove("ckb"); document.documentElement.style.setProperty("--ckh", "0px"); window.dispatchEvent(new Event("resize")) }
  function put(ch) {
    const t = tgt || document.getElementById("lt") || document.getElementById("otm"); if (!t) return; const s = t.selectionStart ?? t.value.length, e = t.selectionEnd ?? s;
    if (ch === "\b") { if (s !== e) t.setRangeText("", s, e, "end"); else if (s > 0) { const pre = t.value.slice(0, s), cut = /[\uD800-\uDBFF][\uDC00-\uDFFF]$/.test(pre) ? 2 : 1; t.setRangeText("", s - cut, s, "end") } }
    else { if (t.maxLength > 0 && t.value.length - (e - s) + ch.length > t.maxLength) return; t.setRangeText(ch, s, e, "end") }
    t.dispatchEvent(new Event("input", { bubbles: true }));
  }
  function press(k) {
    if (k === "⇧") { shift = !shift; return kbRender() }
    if (k === "⌫") return put("\b");
    if (k === "__sym") { lay = lay === "sym" ? "ru" : "sym"; shift = false; return kbRender() }
    if (k === "__lang") { lay = lay === "ru" ? "en" : "ru"; shift = false; return kbRender() }
    if (k === "__hide") { document.activeElement && document.activeElement.blur && document.activeElement.blur(); return kbHide() }
    if (k === "__sys") { kbMode = "sys"; try { localStorage.setItem("dp_kb", "sys") } catch { } kbHide(); $$("#lt,#otm").forEach(i => i.removeAttribute("inputmode")); const t = tgt; if (t) { t.blur(); setTimeout(() => t.focus(), 60) } return }
    if (k === "__send") { const f = tgt && tgt.id === "otm" ? (typeof otSend === "function" ? otSend : null) : (typeof sendC === "function" ? sendC : null); if (f) f(); return }
    const up = shift && lay !== "sym"; put(up ? k.toUpperCase() : k); if (up && !window._caps) { shift = false; kbRender() }
  }
  function kbAttach() { $$("#lt,#otm").forEach(i => { if (kbMode === "own") { i.setAttribute("inputmode", "none"); i.setAttribute("autocomplete", "off") } else i.removeAttribute("inputmode") }) }
  document.addEventListener("focusin", e => { if (!MANAGED(e.target)) return; tgt = e.target; if (kbMode === "own") { e.target.setAttribute("inputmode", "none"); kbShow() } });
  document.addEventListener("pointerdown", e => { if (kbMode !== "own" || !kbEl || !kbEl.classList.contains("on")) return; if (e.target.closest("#dkb,.cmp,.otin,.ib2,.btn,a,button,input,textarea,select,label")) return; if (e.target.closest("#chm,#otl,.chm,.otl")) { document.activeElement && document.activeElement.blur && document.activeElement.blur(); kbHide() } }, true);
  window.kbSwitchOwn = function () { kbMode = "own"; try { localStorage.setItem("dp_kb", "own") } catch { } kbAttach() };

  // ======================= Хуки маршрутов =======================
  const ar = window.afterRoute;
  window.afterRoute = function (path) {
    const r = ar && ar.apply(this, arguments);
    safe(() => {
      const seg = (path || location.hash.slice(1) || "/").split("/").filter(Boolean)[0] || "home"; document.body.dataset.pg = seg;
      if (typeof ME !== "undefined" && ME && !window._lk0) { window._lk0 = 1; lockCheck() }
      kbAttach(); if (!document.querySelector("#lt,#otm")) kbHide(); seenFill(); vwMount(); admDecorate(); setTimeout(admDecorate, 300);
      setTimeout(groupLots, 80); setTimeout(groupLots, 500);
      if (/^\/l\//.test(path || "")) { const id = (path || "").split("/")[2]; vwSend(id); clearInterval(window._vwh); window._vwh = setInterval(() => { if (!/^#\/l\//.test(location.hash)) return clearInterval(window._vwh); vwSent = null; vwSend(id) }, 30000) } else if (vwSent) vwSend(null);
    })();
    return r;
  };
  const CLIP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21.4 11.1l-8.6 8.6a5.2 5.2 0 0 1-7.4-7.4l8.6-8.6a3.5 3.5 0 0 1 5 5l-8.7 8.6a1.8 1.8 0 0 1-2.5-2.5l7.9-7.9"/></svg>';
  function clipFix() { $$('.ib2[aria-label="Вложение"],.ib2[aria-label="Прикрепить скриншот"]').forEach(b => { if (b.dataset.cl) return; b.dataset.cl = 1; b.classList.add("clipb"); b.innerHTML = CLIP }) }
  new MutationObserver(() => { safe(kbAttach)(); safe(clipFix)() }).observe(document.body, { childList: true, subtree: true });
})();
