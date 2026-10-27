// ---- закреплённый выгодный продавец
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
  if (F.game) { h = h.replace('<div id="rl">', '<div id="pinbox"></div><div id="rl">'); }
  return h;
};
const ar5 = window.afterRoute; window.afterRoute = function () { const r = ar5 && ar5.apply(this, arguments); setTimeout(pinLoad, 30); return r };

// ---- страница заказа (как у FunPay): статус, товар, данные, чат и системные уведомления
const OSC = { pending_payment: "wt", paid: "pd", in_progress: "pd", completed: "ok", cancelled: "bd", dispute: "bd" };
const odt = d => new Date(d).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
const ago5 = d => { const m = Math.max(0, Math.round((Date.now() - new Date(d)) / 60000)); return m < 1 ? "только что" : m < 60 ? m + " мин назад" : m < 1440 ? Math.floor(m / 60) + " ч назад" : Math.floor(m / 1440) + " дн назад" };
function otLine(o, e) {
  const n = "#" + (o.number || ""), b = esc(o.buyer_name || "Покупатель"), s = esc(o.seller_name || "Продавец"), info = `${esc(o.game_name)}, ${esc(o.category_name)}, ${esc(o.title)}`;
  const t = {
    pending_payment: `Заказ ${n} создан. ${info}. Ожидается оплата.`,
    paid: `Покупатель <b>${b}</b> оплатил заказ <b>${n}</b>. ${info}. <b>${b}</b>, не забудьте потом нажать кнопку «Подтвердить выполнение заказа».`,
    in_progress: `Продавец <b>${s}</b> приступил к выполнению заказа <b>${n}</b>. Когда получите товар, нажмите «Подтвердить выполнение заказа».`,
    completed: `Покупатель <b>${b}</b> подтвердил выполнение заказа <b>${n}</b>. Деньги переведены продавцу <b>${s}</b>.`,
    cancelled: `Заказ <b>${n}</b> отменён.`,
    dispute: `По заказу <b>${n}</b> открыт спор. Подключится модератор, он увидит переписку в этом чате.`,
  }[e.status] || `Статус заказа ${n}: ${esc(ST[e.status] || e.status)}.`;
  return `<div class="ots"><div class="otn"><b>Система</b><span class="tag">оповещение</span><small class="m">${odt(e.created_at)}</small></div><div class="otb"><i>i</i><p>${t}</p></div></div>`;
}
function otTimeline(o, ms) {
  const items = ms.filter(m => m.kind !== "system" || m.order_id === o.id).map(m => {
    if (m.kind === "system") return `<div class="ots"><div class="otn"><b>Система</b><span class="tag">оповещение</span><small class="m">${odt(m.created_at)}</small></div><div class="otb"><i>i</i><p>${esc(m.body)}</p></div></div>`;
    const mine = m.sender_id === ME.id, nm = m.sender_name || (m.sender_id === o.buyer_id ? o.buyer_name : o.seller_name);
    return `<div class="otm"><div class="otn"><b>${esc(nm || "")}</b>${m.kind === "staff" ? '<span class="tag">модератор</span>' : ""}${mine ? '<span class="tag">вы</span>' : ""}<small class="m">${odt(m.created_at)}</small></div><div class="otx">${esc(m.body === "[вложение]" ? "" : m.body).replace(/\n/g, "<br>")}${atts(m.atts)}</div></div>`;
  });
  return items.join("") || '<p class="m">Сообщений пока нет.</p>';
}
async function orderPage(id) {
  need(); const o = await api("/orders/" + id), buyer = o.buyer_id === ME.id || o.partner_id === ME.id, s = o.status;
  const ms = o.conversation_id ? await api(`/conversations/${o.conversation_id}/messages`) : [];
  const closed = ["completed", "cancelled"].includes(s) ? o.events.filter(e => e.status === s).pop() : null, opened = o.events[0] || { created_at: o.created_at };
  const other = buyer ? o.seller_name : o.buyer_name, otherOn = buyer ? o.seller_online : o.buyer_online, am = buyer ? o.seller_avatar_media : o.buyer_avatar_media, ap = buyer ? o.seller_avatar_preset : o.buyer_avatar_preset;
  const attrs = Object.entries(o.attrs || {}).filter(([k, v]) => v);
  const fld = (l, v) => v ? `<div class="otf"><small>${l}</small><div>${v}</div></div>` : "";
  const acts = [
    s === "pending_payment" && buyer && !o.partner_id ? `<button class="btn pri" onclick="payConfirm('${o.id}')">Оплатить ${rub(o.total_cents)}</button>` : "",
    s === "pending_payment" && !o.partner_id ? `<button class="btn dng" onclick="ost('${o.id}','cancelled')">Отменить заказ</button>` : "",
    s === "paid" && !buyer ? `<button class="btn pri" onclick="ost('${o.id}','in_progress')">Приступить к выполнению</button>` : "",
    ["paid", "in_progress"].includes(s) && buyer ? `<button class="btn pri" onclick="ost('${o.id}','completed')">Подтвердить выполнение заказа</button>` : "",
    ["paid", "in_progress", "completed"].includes(s) && o.partner_id !== ME.id ? `<button class="btn dng" onclick="disp('${o.id}')">Открыть спор</button>` : "",
    s === "completed" && buyer ? `<button class="btn" onclick="rev('${o.id}')">Оставить отзыв продавцу</button>` : "",
  ].filter(Boolean);
  window._ot = { id: o.id, conv: o.conversation_id, lot: o.listing_id, buyer: o.buyer_id, seller: o.seller_id };
  clearInterval(window._otp); window._otp = setInterval(() => { if (!location.hash.startsWith("#/order/")) return clearInterval(window._otp); otRefresh() }, 7000);
  return `<div class="ord"><h1 class="oh">Заказ #${esc(o.number || "")}<span class="os ${OSC[s] || ""}">${esc(ST[s] || s)}</span></h1>
${o.after_msg && buyer ? `<div class="oitem"><small>Оплаченный товар</small><div class="oi">${esc(o.after_msg)}</div></div>` : ""}
${s === "pending_payment" ? `<p class="m">Заказ ещё не оплачен. Деньги списываются с баланса DonutPay (сейчас он тестовый).</p>` : ""}
<div class="otg">${fld("Игра", esc(o.game_name))}${fld("Категория", `<a class="lk" onclick="go('/catalog?game=${o.game}&category=${o.category}')">${esc(o.category_name)}</a>`)}${attrs.map(([k, v]) => fld(esc(k), esc(v))).join("")}</div>
${fld("Краткое описание", esc(o.title) + (o.quantity > 1 ? " × " + o.quantity : ""))}${fld("Подробное описание", esc(o.summary || o.details || "").replace(/\n/g, "<br>"))}
<div class="otg">${fld("Открыт", `${odt(opened.created_at)}<br><span class="m">(${ago5(opened.created_at)})</span>`)}${closed ? fld("Закрыт", `${odt(closed.created_at)}<br><span class="m">(${ago5(closed.created_at)})</span>`) : ""}</div>
<div class="otf"><small>Сумма</small><div class="osum">${rub(o.total_cents)}</div></div>
${acts.length ? `<div class="oacts">${acts.join("")}</div>` : ""}
<div class="card otc"><div class="oth">${avs(other || "?", am, otherOn, ap)}<div style="flex:1;min-width:0"><b><a onclick="go('/u/'+encodeURIComponent('${esc(other || "")}'))">${esc(other || "")}</a></b><div class="m">${otherOn ? "Онлайн" : "Был(а) недавно"}</div></div>${o.conversation_id ? `<button class="btn sm" onclick="go('/chat/${o.conversation_id}')">Весь чат</button>` : ""}</div>
<div class="otl" id="otl">${otTimeline(o, ms)}</div>
<div class="otin"><input id="otm" placeholder="Написать..." maxlength="2000" onkeydown="if(event.key==='Enter')otSend()"><button class="btn pri" onclick="otSend()" aria-label="Отправить">›</button></div></div></div>`;
}
const otRefresh = async () => {
  const t = window._ot, box = document.getElementById("otl"); if (!t || !box || document.activeElement?.id === "otm" && document.getElementById("otm").value) return;
  try { const o = await api("/orders/" + t.id), ms = t.conv ? await api(`/conversations/${t.conv}/messages`) : []; const atBot = box.scrollHeight - box.scrollTop - box.clientHeight < 60; box.innerHTML = otTimeline(o, ms); if (atBot) box.scrollTop = 1e9 } catch { }
};
const otSend = act(async () => {
  const t = window._ot, i = document.getElementById("otm"), body = i.value.trim(); if (!body || window._snd) return; window._snd = 1;
  try { if (!t.conv) { const c = await api("/conversations", { method: "POST", body: { listingId: t.lot } }); t.conv = c.id } await api(`/conversations/${t.conv}/messages`, { method: "POST", body: { body, listingId: t.lot } }); i.value = ""; await otRefresh() } finally { window._snd = 0 }
});

// ---- дуэли магазинов (24 часа)
const dRub = c => (c / 100).toLocaleString("ru-RU") + " ₽";
const dLeft = e => { const ms = new Date(e) - Date.now(); if (ms <= 0) return "завершается"; const h = Math.floor(ms / 36e5), m = Math.floor(ms % 36e5 / 6e4); return (h ? h + " ч " : "") + m + " мин" };
function tug(a, b, na, nb) {
  const t = a + b, pa = t ? Math.round(a / t * 100) : 50;
  return `<div class="dtug"><div class="dtn"><b>${esc(na)}</b><span>${a}</span></div><div class="dbar"><u style="width:${pa}%"></u><i style="left:${pa}%"></i></div><div class="dtn r"><b>${esc(nb)}</b><span>${b}</span></div></div>`;
}
function bdRows(x, y, na, nb) {
  const rows = [["Завершённые заказы", "orders"], ["Новые и повторные покупатели", "unique"], ["Сумма заказов", "amount"], ["Отзывы 4–5★", "reviews"], ["Скорость ответа", "speed"], ["Возвраты", "refunds"]];
  const fl = (x.flagged || 0) + (y.flagged || 0); return `${fl ? `<p class="m"><small>Не засчитано заказов из-за совпадения сети или устройства: ${fl}.</small></p>` : ""}<table class="dtab"><tr><th></th><th>${esc(na)}</th><th>${esc(nb)}</th></tr>${rows.map(r => `<tr><td>${r[0]}</td><td>${x[r[1]]}</td><td>${y[r[1]]}</td></tr>`).join("")}<tr class="tt"><td>Итого</td><td>${x.total}</td><td>${y.total}</td></tr></table>`;
}
const duelHow = r => `<details class="card dhow" ${localStorage.dh === "0" ? "" : "open"} ontoggle="try{localStorage.dh=this.open?'1':'0'}catch{}"><summary><b>Как работают дуэли</b></summary>
<ol><li><b>Что это.</b> Дуэль на 24 часа между двумя магазинами одной игры и категории. Кто набрал больше очков, тот победил и получает приз. Покупателям не нужно ничего делать, они просто покупают как обычно, а очки считаются автоматически.</li>
<li><b>Как найти соперника.</b> Выберите игру (популярные первыми) и категорию, затем нажмите «Найти соперника» либо включите «Автодуэль»: тогда соперник подбирается сам, каждый день. Не больше одной дуэли за 24 часа.</li>
<li><b>Кто достаётся в соперники.</b> Система сравнивает вашу <b>лигу</b> (по обороту завершённых заказов за 30 дней: Бронза до 5 000 ₽, Серебро до 50 000 ₽, Золото до 300 000 ₽, Платина выше) и <b>рейтинг дуэлей</b> (у всех старт 1000). Подбирает близких по силе, поэтому новичок не попадёт на крупный магазин. Если соперника нет долго, допуск постепенно расширяется до соседней лиги.</li>
<li><b>Как считаются очки.</b><br>+40 за каждый завершённый заказ<br>+30 за нового покупателя, +5 за повторного<br>+1 за каждые 100 ₽ оборота (не больше 300)<br>+15 за ответ новому покупателю быстрее 5 минут, −10 если он ждал больше часа<br>+50 за отзыв 5★, +20 за отзыв 4★<br>−40 за возврат денег покупателю<br>Заказ считается только когда покупатель подтвердил получение. С одного покупателя можно получить не больше ${r.buyer_cap} очков.</li>
<li><b>Что даёт победа.</b> Три приза. (1) Бонус на баланс: ${r.bonus_pct}% от суммы ваших завершённых заказов за дуэль, но не больше ${r.bonus_max} ₽. (2) Буст в каталоге: ${r.boost_h} часов ваши лоты стоят выше остальных в общем списке. (3) Комиссия с продаж ниже на 3 процентных пункта на 7 дней. Рейтинг дуэлей растёт, вы попадаетесь более сильным соперникам. Проигрыш: рейтинг немного падает, денежных штрафов нет. Ничья: победителя нет, приз не выдаётся.</li>
<li><b>Защита от накрутки.</b> Не считаются заказы, отзывы и диалоги от самого себя и от соперника, заказы дешевле ${r.min_order} ₽ и аккаунты младше ${r.min_age_days} дней. Не считаются и покупатели с той же сетью (IP) или устройством, что у продавца: для этого мы храним только обезличенные хэши. Если вы покупаете из одной домашней сети с продавцом, очки не засчитаются. Очки идут только после подтверждения получения. Подозрительные дуэли проверяет администрация и может отменить результат.</li>
<li><b>Комиссии.</b> Сейчас они тестовые, как и баланс. С каждой продажи удерживается ${r.sale_fee}%, при выводе денег ещё ${r.withdraw_fee}%. Реальные платежи пока не подключены.</li></ol></details>`;
function duelCard(d, mine) {
  const a = d.live_a?.total ?? d.score_a ?? 0, b = d.live_b?.total ?? d.score_b ?? 0;
  return `<div class="card dc ${mine ? "dmine" : ""}"><div class="row bet"><span class="tag">${esc(d.game_name || "")} · ${esc(d.category_name)}</span><small class="m">осталось ${dLeft(d.ends_at)}</small></div>${tug(a, b, d.name_a, d.name_b)}${d.live_a && mine ? bdRows(d.live_a, d.live_b, d.name_a, d.name_b) : ""}<button class="btn sm" style="margin-top:8px" onclick="duelLog('${d.id}')">Лента событий</button><div id="dl${d.id}"></div></div>`;
}
const duelLog = act(async id => {
  const box = document.getElementById("dl" + id); if (box.dataset.open === "1") { box.innerHTML = ""; box.dataset.open = ""; return }
  const r = await api(`/duels/${id}/log`); box.dataset.open = "1";
  box.innerHTML = `<div class="dlog">${r.log.length ? r.log.map(e => `<div class="dle"><span>${new Date(e.t).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</span><b>${esc(e.side === "a" ? r.d.name_a : r.d.name_b)}</b><span style="flex:1">${esc(e.text)}</span><b class="${e.pts < 0 ? "neg2" : ""}">${e.pts > 0 ? "+" : ""}${e.pts}</b></div>`).join("") : '<p class="m">Событий пока нет. Лента обновляется по мере завершения заказов и появления отзывов.</p>'}</div>`;
});
const dgSel = d => { const gs = d.games, myq = d.me?.queue; let g = gs.find(x => x.id === window._dg) || (myq && gs.find(x => x.id === myq.game_id)) || gs.find(x => x.cats.some(c => c.mine)) || gs[0]; window._dg = g?.id; let c = g?.cats.find(x => x.id === window._dc) || g?.cats.find(x => x.mine) || g?.cats[0]; window._dc = c?.id; return { g, c } };
const duelPick = (g, c) => { if (g) { window._dg = g; window._dc = null } if (c) window._dc = c; const el = document.getElementById("duels"); if (el && window._dd) el.innerHTML = duelBody(window._dd) };
function duelBody(d) {
  window._dd = d;
  const me = d.me, mineD = me && d.live.find(x => x.seller_a === ME?.id || x.seller_b === ME?.id), others = d.live.filter(x => x !== mineD);
  const head = me ? `<div class="card dme"><div class="row bet"><div><small class="m">Ваша лига</small><div class="dl">${esc(me.league)}</div></div><div style="text-align:right"><small class="m">Рейтинг дуэлей</small><div class="dl">${me.rating}</div></div></div><div class="m" style="margin-top:6px">Победы ${me.wins} · поражения ${me.losses}${me.boost_until ? ` · буст в каталоге до ${new Date(me.boost_until).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}</div></div>` : "";
  let part;
  if (!ME) part = `<button class="btn pri" onclick="NEXT='/battles';go('/login')">Войдите, чтобы участвовать</button>`;
  else if (!ME.is_seller) part = `<p class="m">Участвовать могут продавцы с подписанным кодексом. Покупатели могут следить за дуэлями ниже.</p><button class="btn" onclick="go('/verify')">Стать продавцом</button>`;
  else if (mineD) part = `<p class="m">У вас идёт дуэль. Новую можно начать через 24 часа после старта этой.</p>`;
  else if (!d.games.length) part = `<p class="m">Пока нет игр с активными лотами. Создайте лот, чтобы участвовать.</p>`;
  else {
    const { g, c } = dgSel(d), gname = id => d.games.find(x => x.id === id)?.name || "", cname = (gid, cid) => d.games.find(x => x.id === gid)?.cats.find(x => x.id === cid)?.name || "";
    const on = c && me.auto.some(a => a.game_id === g.id && a.category_id === c.id), canPlay = c && c.mine;
    part = me.queue ? `<p class="dq">Идёт поиск соперника: ${esc(gname(me.queue.game_id))} · ${esc(cname(me.queue.game_id, me.queue.category_id))}. Как только найдётся пара, дуэль начнётся сама.</p><button class="btn" onclick="duelCancel()">Отменить поиск</button>`
      : `${me.next_at ? `<p class="m">Следующую дуэль можно начать после ${new Date(me.next_at).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}.</p>` : ""}<label>1. Игра <small class="m">(популярные первыми)</small></label><div class="dgs">${d.games.map(x => `<button class="dgc ${x.id === g.id ? "on" : ""}" onclick="duelPick('${x.id}')"><b>${esc(x.name)}</b><small>${x.lots} лот.${x.duels ? " · дуэлей " + x.duels : ""}</small></button>`).join("")}</div><label>2. Категория</label><div class="dcs">${g.cats.map(x => `<button class="chp ${x.id === (c && c.id) ? "on" : ""} ${x.mine ? "" : "dim"}" onclick="duelPick(null,'${x.id}')">${esc(x.name)}<small>${x.lots}</small></button>`).join("") || '<span class="m">В этой игре нет категорий с лотами.</span>'}</div>${c && !c.mine ? `<p class="m"><small>У вас нет активных лотов в «${esc(g.name)} · ${esc(c.name)}». Выберите категорию, где они есть, или создайте лот.</small></p>` : ""}<div class="row" style="margin-top:12px;gap:8px"><button class="btn pri" style="flex:1" ${canPlay ? "" : "disabled"} onclick="duelFind()">Найти соперника</button><button class="btn" style="flex:1" ${canPlay || on ? "" : "disabled"} onclick="duelAuto(${on ? "false" : "true"})">${on ? "Выключить автодуэль" : "Автодуэль каждый день"}</button></div>${me.auto.length ? `<p class="m" style="margin:10px 0 4px"><small>Автодуэль включена:</small></p><div class="dcs">${me.auto.map(a => `<button class="chp on" onclick="duelAutoOff('${a.game_id}','${a.category_id}')">${esc(gname(a.game_id))} · ${esc(cname(a.game_id, a.category_id))} ✕</button>`).join("")}</div>` : ""}`;
  }
  return `${head}${mineD ? `<h3>Ваша дуэль</h3>${duelCard(mineD, true)}` : ""}<h3>Участие</h3><div class="card">${part}</div><h3>Идут сейчас</h3>${others.map(x => duelCard(x)).join("") || empty("Сейчас нет других дуэлей. Дуэль начинается, когда в одной игре и категории нашлись два подходящих по силе магазина.")}<h3>Недавние итоги</h3>${d.done.map(x => `<div class="card row bet"><span style="display:flex;gap:8px;align-items:center;min-width:0">${x.winner_id ? ic4("trophy", 18) : ""}<span style="overflow-wrap:anywhere"><b>${x.winner_id ? esc(x.winner_id === x.seller_a ? x.name_a : x.name_b) : "Ничья"}</b><br><small class="m">${esc(x.name_a)} ${x.score_a} : ${x.score_b} ${esc(x.name_b)}</small></span></span><small class="m" style="text-align:right">${esc(x.game_name || "")} · ${esc(x.category_name)}${x.bonus_cents ? "<br>бонус " + dRub(x.bonus_cents) : ""}</small></div>`).join("") || empty("Завершённых дуэлей пока нет.")}`;
}
battlesPage = async function () {
  const d = await api("/duels"), fe = await api("/fees").catch(() => ({})); d.rules.sale_fee = fe.sale_pct ?? 15; d.rules.withdraw_fee = fe.withdraw_pct ?? 3; clearInterval(window._dp);
  window._dp = setInterval(async () => { if (!/^#\/battles/.test(location.hash)) return clearInterval(window._dp);  try { const n = await api("/duels"); const el = document.getElementById("duels"); if (el) el.innerHTML = duelBody(n) } catch { } }, 8000);
  return `<h2 class="h2i">${ic4("swords", 20)}Дуэли магазинов</h2><p class="m" style="margin-top:0">Два магазина одной категории соревнуются 24 часа. Побеждает тот, кто лучше обслужил покупателей. Победитель получает деньги на баланс и поднятие в каталоге.</p>${duelHow(d.rules)}<div id="duels">${duelBody(d)}</div>`;
};
const duelFind = act(async () => { await api("/duels/find", { method: "POST", body: { gameId: window._dg, categoryId: window._dc } }); toast("Ищем соперника"); route() });
const duelCancel = act(async () => { await api("/duels/cancel", { method: "POST" }); route() });
const duelAuto = act(async on => { await api("/duels/auto", { method: "POST", body: { gameId: window._dg, categoryId: window._dc, on } }); toast(on ? "Автодуэль включена" : "Автодуэль выключена"); route() });
const duelAutoOff = act(async (g, c) => { await api("/duels/auto", { method: "POST", body: { gameId: g, categoryId: c, on: false } }); route() });

// ---- тестовые комиссии: расчёт в форме лота, вывод, заявки
let FEES = null;
const feesGet = async () => FEES || (FEES = await api("/fees").catch(() => ({ sale_pct: 15, my_sale_pct: 15, withdraw_pct: 3 })));
const mny = n => (Math.round(n * 100) / 100).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₽";
async function feeBox() {
  const p = document.getElementById("sp"); if (!p) return; const f = await feesGet();
  let b = document.getElementById("sfee"); if (!b) { b = document.createElement("div"); b.id = "sfee"; b.className = "card sfee"; const ss0 = document.getElementById("ss"); (((ss0 || p).closest(".grid")) || (ss0 || p).closest(".sf") || (ss0 || p).parentElement).after(b) }
  const price = +p.value || 0, st = +(document.getElementById("ss")?.value) || 1, fee = price * f.my_sale_pct / 100, net = price - fee, wd = net * f.withdraw_pct / 100;
  b.innerHTML = `<b>Сколько вы получите</b><div class="sfr"><span>Покупатель платит</span><b>${mny(price)}</b></div><div class="sfr"><span>Комиссия площадки ${f.my_sale_pct}%${f.my_sale_pct < f.sale_pct ? " (скидка победителю дуэли)" : ""}</span><b>−${mny(fee)}</b></div><div class="sfr tt"><span>Вам на баланс</span><b>${mny(net)}</b></div><div class="sfr"><span>При выводе ещё ${f.withdraw_pct}%</span><b>−${mny(wd)}</b></div><div class="sfr"><span>На руки после вывода</span><b>${mny(net - wd)}</b></div>${st > 1 ? `<small class="m">Цена за 1 шт. Всего за ${st} шт.: ${mny(price * st)}, вам ${mny(net * st)}.</small>` : ""}<small class="m">Комиссии тестовые: баланс пока не настоящий. Деньги переходят вам после подтверждения получения покупателем.</small>`;
}
document.addEventListener("input", e => { if (e.target && (e.target.id === "sp" || e.target.id === "ss")) feeBox() });
{ const ar6 = window.afterRoute; window.afterRoute = function () { const r = ar6 && ar6.apply(this, arguments); setTimeout(feeBox, 120); return r } }
withdrawForm = async function (bal) {
  const f = await feesGet(), a0 = Math.floor(bal) >= 10 ? Math.floor(bal) : 10;
  window._wdp = f.withdraw_pct; window._wdm = "card"; window._wdb = bal;
  mdl(`<div class="wdh"><small>Доступно к выводу</small><div class="wdb">${fm(bal)}</div></div><label>Сумма вывода</label><div class="sf"><input id="wda" type="number" inputmode="numeric" min="10" value="${a0}" oninput="wdCalc()"><span>₽</span></div><div class="wdq">${[["25%", .25], ["50%", .5], ["Всё", 1]].map(x => `<button type="button" onclick="wdQ(${x[1]})">${x[0]}</button>`).join("")}</div><div class="sfee card" id="wdc" style="margin:12px 0"></div><label>Способ получения</label><div class="wdm">${[["card", "Банковская карта"], ["sbp", "СБП"], ["crypto", "Крипта"], ["other", "Другое"]].map((x, i) => `<button type="button" class="${i ? "" : "on"}" data-m="${x[0]}" onclick="wdM('${x[0]}')">${x[1]}</button>`).join("")}</div><label>Реквизиты</label><input id="wdd" maxlength="200" placeholder="Номер карты, телефон или адрес кошелька"><p class="m" style="margin:10px 0 0"><small>Заявки обрабатывает администратор вручную. Баланс и комиссия ${f.withdraw_pct}% пока тестовые, реальные деньги не переводятся.</small></p><button class="btn pri big" style="width:100%;margin-top:12px" onclick="withdrawDo()">Отправить заявку</button>`);
  wdCalc();
};
const wdQ = k => { const e = document.getElementById("wda"); e.value = Math.max(10, Math.floor(window._wdb * k)); wdCalc() };
const wdM = m => { window._wdm = m; document.querySelectorAll(".wdm button").forEach(b => b.classList.toggle("on", b.dataset.m === m)) };
const wdCalc = () => { const a = +document.getElementById("wda")?.value || 0, fee = Math.round(a * window._wdp) / 100; const e = document.getElementById("wdc"); if (e) e.innerHTML = `<div class="sfr"><span>Спишется с баланса</span><b>${mny(a)}</b></div><div class="sfr"><span>Комиссия ${window._wdp}%</span><b>−${mny(fee)}</b></div><div class="sfr tt"><span>Вы получите</span><b>${mny(a - fee)}</b></div>` };
wdAdmin = async function () {
  const ws = await api("/admin/withdrawals");
  return ws.map(w => `<div class="card"><div class="row bet"><b>${esc(w.username)} · ${fm(w.amount)}</b><span class="tag">${{ pending: "Ожидает", paid: "Выплачено", rejected: "Отклонено" }[w.status]}</span></div><div class="m">К выплате: <b>${fm(w.amount - (w.fee || 0))}</b> (комиссия ${fm(w.fee || 0)})</div><div class="m">${{ card: "Карта", sbp: "СБП", crypto: "Крипта", other: "Другое" }[w.method]}: ${esc(w.details)}</div><small class="m">${fmtD(w.created_at)}</small>${w.status === "pending" ? `<div class="row" style="margin-top:8px"><button class="btn sm pri" onclick="wdAct('${w.id}','paid')">Выплачено</button><button class="btn sm dng" onclick="wdAct('${w.id}','reject')">Отклонить и вернуть</button></div>` : ""}</div>`).join("") || empty("Заявок на вывод нет.");
};

// ---- промокоды (владелец)
async function promosAdmin() {
  const ps = await api("/admin/promos");
  const val = p => p.kind === "percent" ? `${p.value}%` : `${(p.value).toLocaleString("ru-RU")} ₽`;
  const cond = p => [p.max_discount_cents != null ? `скидка не больше ${dRub(p.max_discount_cents)}` : "", p.min_order_cents > 0 ? `заказ от ${dRub(p.min_order_cents)}` : "", p.max_order_cents != null ? `заказ до ${dRub(p.max_order_cents)}` : "", p.max_uses != null ? `использований ${p.uses} из ${p.max_uses}` : `использован ${p.uses} раз`, `на человека ${p.per_user}`, p.expires_at ? `до ${new Date(p.expires_at).toLocaleDateString("ru-RU")}` : "без срока"].filter(Boolean).join(" · ");
  return `<div class="card"><b>Новый промокод</b><p class="m" style="margin:4px 0 8px">Скидку оплачивает площадка: продавец получает всю сумму минус комиссию. Покупатель вводит код при оплате заказа.</p><button class="btn pri" style="width:100%" onclick="promoForm()">Создать промокод</button></div>${ps.map(p => `<div class="card"><div class="row bet"><b class="pmcode">${esc(p.code)}</b><span class="tag">${p.active ? "Включён" : "Выключен"}</span></div><div style="font-size:18px;font-weight:700;margin:4px 0">−${val(p)}</div><div class="m">${cond(p)}</div><div class="row" style="margin-top:8px"><button class="btn sm" onclick="promoToggle('${p.id}',${!p.active})">${p.active ? "Выключить" : "Включить"}</button><button class="btn sm dng" onclick="promoDel('${p.id}')">Удалить</button></div></div>`).join("") || empty("Промокодов пока нет.")}`;
}
function promoForm() {
  mdl(`<h3 style="margin:0 0 8px">Новый промокод</h3><label>Код (латиница и цифры)</label><input id="pc" maxlength="32" autocapitalize="characters" style="text-transform:uppercase" placeholder="START5"><label>Тип скидки</label><select id="pk" onchange="$('#pvl').textContent=this.value==='percent'?'Скидка, %':'Скидка, ₽'"><option value="percent">Процент от заказа</option><option value="fixed">Фиксированная сумма</option></select><label id="pvl">Скидка, %</label><input id="pv" type="number" inputmode="decimal" min="0" step="0.01" placeholder="5"><label>Максимум скидки, ₽ (необязательно)</label><input id="pm" type="number" inputmode="decimal" min="0" placeholder="5000"><div class="grid"><div><label>Заказ от, ₽</label><input id="pmn" type="number" inputmode="decimal" min="0" placeholder="0"></div><div><label>Заказ до, ₽</label><input id="pmo" type="number" inputmode="decimal" min="0" placeholder="без лимита"></div></div><div class="grid"><div><label>Всего использований</label><input id="pu" type="number" inputmode="numeric" min="1" placeholder="без лимита"></div><div><label>На одного человека</label><input id="pp" type="number" inputmode="numeric" min="1" value="1"></div></div><label>Действует дней (необязательно)</label><input id="pd" type="number" inputmode="numeric" min="1" placeholder="без срока"><button class="btn pri" style="width:100%;margin-top:12px" onclick="promoSave()">Создать</button>`);
}
const promoSave = act(async () => { await api("/admin/promos", { method: "POST", body: { code: $("#pc").value, kind: $("#pk").value, value: $("#pv").value, max_discount: $("#pm").value, min_order: $("#pmn").value, max_order: $("#pmo").value, max_uses: $("#pu").value, per_user: $("#pp").value, days: $("#pd").value } }); $("#md")?.remove(); toast("Промокод создан"); route() });
const promoToggle = act(async (id, on) => { await api("/admin/promos/" + id, { method: "PATCH", body: { active: on } }); route() });
const promoDel = id => ask("Удалить промокод? Уже оформленные заказы не изменятся.", "Удалить", act(async () => { await api("/admin/promos/" + id, { method: "DELETE" }); route() }));


// ---- формы лота: секции отдельными карточками
const splitLf = h => { let n = 0; return h.replace(/<div class="lsec">/g, m => n++ ? '</div><div class="card lf"><div class="lsec">' : m) };
{ const _sell = sell, _edit = editPage; sell = async function () { return splitLf(await _sell.apply(this, arguments)) }; editPage = async function () { return splitLf(await _edit.apply(this, arguments)) } }

// ---- история цены: аккуратный график, статистика и последние изменения
function chart2(h) {
  const W = 340, H = 150, L = 8, R = 8, T = 14, B = 22, ys = h.map(p => p.price_cents), mn = Math.min(...ys), mx = Math.max(...ys), sp = Math.max(1, mx - mn), pad = sp * .18, lo = mn - (mx === mn ? mn * .1 : pad), hi = mx + (mx === mn ? mn * .1 : pad);
  const t0 = +new Date(h[0].created_at), tn = Math.max(Date.now(), +new Date(h[h.length - 1].created_at)), X = t => L + (W - L - R) * (tn === t0 ? 0 : (t - t0) / (tn - t0)), Y = v => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
  let d = "", a = ""; h.forEach((p, i) => { const x = X(+new Date(p.created_at)), y = Y(p.price_cents); d += i ? `H${x.toFixed(1)}V${y.toFixed(1)}` : `M${x.toFixed(1)} ${y.toFixed(1)}` }); d += `H${X(tn).toFixed(1)}`;
  a = d + `V${H - B}H${X(t0).toFixed(1)}Z`;
  const grid = [0, .5, 1].map(k => { const v = lo + (hi - lo) * k, y = Y(v); return `<line x1="${L}" x2="${W - R}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" class="gl"/>` }).join("");
  const dots = h.map(p => `<circle cx="${X(+new Date(p.created_at)).toFixed(1)}" cy="${Y(p.price_cents).toFixed(1)}" r="3.5" class="dt"/>`).join("");
  const fd = x => new Date(x).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  return `<svg class="chart2" viewBox="0 0 ${W} ${H}" role="img" aria-label="График цены"><defs><linearGradient id="pgr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--p)" stop-opacity=".35"/><stop offset="1" stop-color="var(--p)" stop-opacity="0"/></linearGradient></defs>${grid}<path d="${a}" fill="url(#pgr)"/><path d="${d}" class="ln2"/>${dots}<text x="${L}" y="${H - 6}" class="ax">${fd(t0)}</text><text x="${W - R}" y="${H - 6}" class="ax" text-anchor="end">${fd(tn)}</text></svg>`;
}
loadHist = async function (el) {
  const id = el.dataset.l;
  try {
    const h = await api(`/listings/${id}/price-history`), ys = h.map(p => p.price_cents), cur = ys[ys.length - 1], first = ys[0], diff = cur - first, pc = first ? Math.round(diff / first * 100) : 0;
    let w = null; if (ME && el.dataset.own !== "1") w = await api(`/listings/${id}/watch`).catch(() => null);
    const wui = el.dataset.own === "1" ? "" : !ME ? `<button class="btn pri" style="width:100%" onclick="NEXT=location.hash.slice(1);go('/login')">Войдите, чтобы следить за ценой</button>` : w && w.watching ? `<div class="row bet"><span class="m">Вы следите за ценой${w.target_cents ? `, порог ${rubc(w.target_cents)}` : ""}</span><button class="btn sm" onclick="unwatch('${id}')">Не следить</button></div>` : `<div class="phw"><input id="wt" type="number" min="1" step="0.01" placeholder="Порог, ₽ (необязательно)"><button class="btn pri" onclick="watchOn('${id}')">Следить за ценой</button></div>`;
    const ch = []; for (let i = h.length - 1; i > 0 && ch.length < 5; i--) { const a = h[i - 1].price_cents, b = h[i].price_cents; ch.push(`<div class="phr"><span class="m">${new Date(h[i].created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })}</span><span>${rubc(a)} → <b>${rubc(b)}</b></span><span class="${b < a ? "pdn" : "pup"}">${b < a ? "▼" : "▲"} ${Math.abs(Math.round((b - a) / a * 100))}%</span></div>`) }
    el.innerHTML = `<div class="card phc"><div class="phtop"><div><small class="m">Сейчас</small><div class="phn">${rubc(cur)}</div></div>${h.length > 1 ? `<span class="phb ${diff < 0 ? "pdn" : diff > 0 ? "pup" : ""}">${diff < 0 ? "▼" : diff > 0 ? "▲" : "•"} ${Math.abs(pc)}% с ${new Date(h[0].created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</span>` : ""}</div>${h.length > 1 ? chart2(h) : `<p class="m" style="margin:10px 0">Цена не менялась с ${new Date(h[0].created_at).toLocaleDateString("ru-RU")}.</p>`}<div class="phs"><div><small>Минимум</small><b>${rubc(Math.min(...ys))}</b></div><div><small>Максимум</small><b>${rubc(Math.max(...ys))}</b></div><div><small>Изменений</small><b>${h.length - 1}</b></div></div>${ch.length ? `<div class="phl"><small class="m">Последние изменения</small>${ch.join("")}</div>` : ""}${wui ? `<div class="phwr">${wui}</div>` : ""}</div>`;
  } catch (e) { el.innerHTML = `<p class="m">История цены недоступна: ${esc(e.message)}</p>` }
};
