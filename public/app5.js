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
  const items = [...(o.events || []).map(e => ({ t: new Date(e.created_at), h: otLine(o, e) })), ...ms.map(m => {
    const mine = m.sender_id === ME.id, nm = m.sender_id === o.buyer_id ? o.buyer_name : o.seller_name;
    return { t: new Date(m.created_at), h: `<div class="otm"><div class="otn"><b>${esc(nm || "")}</b>${mine ? '<span class="tag">вы</span>' : ""}<small class="m">${odt(m.created_at)}</small></div><div class="otx">${esc(m.body === "[вложение]" ? "" : m.body).replace(/\n/g, "<br>")}${atts(m.atts)}</div></div>` };
  })].sort((a, b) => a.t - b.t);
  return items.map(i => i.h).join("") || '<p class="m">Сообщений пока нет.</p>';
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
  const rows = [["Завершённые заказы", "orders"], ["Новые и повторные покупатели", "unique"], ["Сумма заказов", "amount"], ["Отзывы 4–5★", "reviews"], ["Возвраты", "refunds"]];
  return `<table class="dtab"><tr><th></th><th>${esc(na)}</th><th>${esc(nb)}</th></tr>${rows.map(r => `<tr><td>${r[0]}</td><td>${x[r[1]]}</td><td>${y[r[1]]}</td></tr>`).join("")}<tr class="tt"><td>Итого</td><td>${x.total}</td><td>${y.total}</td></tr></table>`;
}
const duelHow = r => `<details class="card dhow" ${localStorage.dh === "0" ? "" : "open"} ontoggle="try{localStorage.dh=this.open?'1':'0'}catch{}"><summary><b>Как работают дуэли</b></summary>
<ol><li><b>Что это.</b> Дуэль на 24 часа между двумя магазинами одной категории. Кто набрал больше очков, тот победил и получает приз. Покупателям не нужно ничего делать, они просто покупают как обычно, а очки считаются автоматически.</li>
<li><b>Как найти соперника.</b> Выберите категорию и нажмите «Найти соперника» либо включите «Автодуэль»: тогда соперник подбирается сам, каждый день. Не больше одной дуэли за 24 часа.</li>
<li><b>Кто достаётся в соперники.</b> Система сравнивает вашу <b>лигу</b> (по обороту завершённых заказов за 30 дней: Бронза до 5 000 ₽, Серебро до 50 000 ₽, Золото до 300 000 ₽, Платина выше) и <b>рейтинг дуэлей</b> (у всех старт 1000). Подбирает близких по силе, поэтому новичок не попадёт на крупный магазин. Если соперника нет долго, допуск постепенно расширяется до соседней лиги.</li>
<li><b>Как считаются очки.</b><br>+40 за каждый завершённый заказ<br>+30 за нового покупателя, +5 за повторного<br>+1 за каждые 100 ₽ оборота (не больше 300)<br>+50 за отзыв 5★, +20 за отзыв 4★<br>−40 за возврат денег покупателю<br>Заказ считается только когда покупатель подтвердил получение. С одного покупателя можно получить не больше ${r.buyer_cap} очков.</li>
<li><b>Что даёт победа.</b> Бонус на баланс: ${r.bonus_pct}% от суммы ваших завершённых заказов за дуэль, но не больше ${r.bonus_max} ₽. Буст в каталоге: ${r.boost_h} часов ваши лоты стоят выше остальных в общем списке. Рейтинг дуэлей растёт, вы попадаёте к более сильным соперникам. Проигрыш: рейтинг немного падает, денежных штрафов нет. Ничья: победителя нет, приз не выдаётся.</li>
<li><b>Защита от накрутки.</b> Не считаются заказы от самого себя и от соперника, дешевле ${r.min_order} ₽ и от аккаунтов младше ${r.min_age_days} дней. Очки считаются только после подтверждения получения и оплаты. Подозрительные дуэли проверяет администрация и может отменить результат.</li>
<li><b>Что ещё не подключено.</b> Очки за скорость ответа и снижение комиссии: у DonutPay пока нет комиссии. Баланс сейчас тестовый, бонус начисляется на него.</li></ol></details>`;
function duelCard(d, mine) {
  const a = d.live_a?.total ?? d.score_a ?? 0, b = d.live_b?.total ?? d.score_b ?? 0;
  return `<div class="card dc ${mine ? "dmine" : ""}"><div class="row bet"><span class="tag">${esc(d.category_name)}</span><small class="m">осталось ${dLeft(d.ends_at)}</small></div>${tug(a, b, d.name_a, d.name_b)}${d.live_a && mine ? bdRows(d.live_a, d.live_b, d.name_a, d.name_b) : ""}<button class="btn sm" style="margin-top:8px" onclick="duelLog('${d.id}')">Лента событий</button><div id="dl${d.id}"></div></div>`;
}
const duelLog = act(async id => {
  const box = document.getElementById("dl" + id); if (box.dataset.open === "1") { box.innerHTML = ""; box.dataset.open = ""; return }
  const r = await api(`/duels/${id}/log`); box.dataset.open = "1";
  box.innerHTML = `<div class="dlog">${r.log.length ? r.log.map(e => `<div class="dle"><span>${new Date(e.t).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</span><b>${esc(e.side === "a" ? r.d.name_a : r.d.name_b)}</b><span style="flex:1">${esc(e.text)}</span><b class="${e.pts < 0 ? "neg2" : ""}">${e.pts > 0 ? "+" : ""}${e.pts}</b></div>`).join("") : '<p class="m">Событий пока нет. Лента обновляется по мере завершения заказов и появления отзывов.</p>'}</div>`;
});
function duelBody(d) {
  const me = d.me, mineD = me && d.live.find(x => x.seller_a === ME?.id || x.seller_b === ME?.id), others = d.live.filter(x => x !== mineD);
  const head = me ? `<div class="card dme"><div class="row bet"><div><small class="m">Ваша лига</small><div class="dl">${esc(me.league)}</div></div><div style="text-align:right"><small class="m">Рейтинг дуэлей</small><div class="dl">${me.rating}</div></div></div><div class="m" style="margin-top:6px">Победы ${me.wins} · поражения ${me.losses}${me.boost_until ? ` · буст в каталоге до ${new Date(me.boost_until).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}</div></div>` : "";
  let part;
  if (!ME) part = `<button class="btn pri" onclick="NEXT='/battles';go('/login')">Войдите, чтобы участвовать</button>`;
  else if (!ME.is_seller) part = `<p class="m">Участвовать могут продавцы с подписанным кодексом. Покупатели могут следить за дуэлями ниже.</p><button class="btn" onclick="go('/verify')">Стать продавцом</button>`;
  else if (mineD) part = `<p class="m">У вас идёт дуэль. Новую можно начать через 24 часа после старта этой.</p>`;
  else {
    const sel = window._dcat || (me.queue ? me.queue.category_id : d.categories[0]?.id);
    part = `${me.queue ? `<p class="dq">Идёт поиск соперника в категории «${esc(d.categories.find(c => c.id === me.queue.category_id)?.name || "")}». Как только найдётся пара, дуэль начнётся сама.</p><button class="btn" onclick="duelCancel()">Отменить поиск</button>` : `${me.next_at ? `<p class="m">Следующую дуэль можно начать после ${new Date(me.next_at).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}.</p>` : ""}<label>Категория</label><select id="dcat" onchange="window._dcat=this.value;route()">${d.categories.map(c => `<option value="${c.id}" ${c.id === sel ? "selected" : ""}>${esc(c.name)}${me.auto.includes(c.id) ? " · автодуэль включена" : ""}</option>`).join("")}</select><div class="row" style="margin-top:10px;gap:8px"><button class="btn pri" style="flex:1" onclick="duelFind()">Найти соперника</button><button class="btn" style="flex:1" onclick="duelAuto(${me.auto.includes(sel) ? "false" : "true"})">${me.auto.includes(sel) ? "Выключить автодуэль" : "Автодуэль каждый день"}</button></div><p class="m"><small>Нужен хотя бы один активный лот в выбранной категории.</small></p>`}`;
  }
  return `${head}${mineD ? `<h3>Ваша дуэль</h3>${duelCard(mineD, true)}` : ""}<h3>Участие</h3><div class="card">${part}</div><h3>Идут сейчас</h3>${others.map(x => duelCard(x)).join("") || empty("Сейчас нет других дуэлей. Дуэль начинается, когда в категории нашлись два подходящих по силе магазина.")}<h3>Недавние итоги</h3>${d.done.map(x => `<div class="card row bet"><span style="display:flex;gap:8px;align-items:center;min-width:0">${x.winner_id ? ic4("trophy", 18) : ""}<span style="overflow-wrap:anywhere"><b>${x.winner_id ? esc(x.winner_id === x.seller_a ? x.name_a : x.name_b) : "Ничья"}</b><br><small class="m">${esc(x.name_a)} ${x.score_a} : ${x.score_b} ${esc(x.name_b)}</small></span></span><small class="m" style="text-align:right">${esc(x.category_name)}${x.bonus_cents ? "<br>бонус " + dRub(x.bonus_cents) : ""}</small></div>`).join("") || empty("Завершённых дуэлей пока нет.")}`;
}
battlesPage = async function () {
  const d = await api("/duels"); clearInterval(window._dp);
  window._dp = setInterval(async () => { if (!/^#\/battles/.test(location.hash)) return clearInterval(window._dp); if (document.querySelector("#duels select:focus")) return; try { const n = await api("/duels"); const el = document.getElementById("duels"); if (el) el.innerHTML = duelBody(n) } catch { } }, 8000);
  return `<h2 class="h2i">${ic4("swords", 20)}Дуэли магазинов</h2><p class="m" style="margin-top:0">Два магазина одной категории соревнуются 24 часа. Побеждает тот, кто лучше обслужил покупателей. Победитель получает деньги на баланс и поднятие в каталоге.</p>${duelHow(d.rules)}<div id="duels">${duelBody(d)}</div>`;
};
const duelFind = act(async () => { const c = document.getElementById("dcat")?.value; await api("/duels/find", { method: "POST", body: { categoryId: c } }); toast("Ищем соперника"); route() });
const duelCancel = act(async () => { await api("/duels/cancel", { method: "POST" }); route() });
const duelAuto = act(async on => { const c = document.getElementById("dcat")?.value; await api("/duels/auto", { method: "POST", body: { categoryId: c, on } }); toast(on ? "Автодуэль включена" : "Автодуэль выключена"); route() });
