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
