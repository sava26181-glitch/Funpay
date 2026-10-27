// v16: автовыдача, устойчивая прокрутка чата, финансы
// ---- значок автовыдачи (галочка с молнией)
const BOLT = '<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path d="M13 2 4 14h6l-1 8 9-12h-6z" fill="currentColor"/></svg>';
const autoBadge = () => `<span class="abd" title="Автовыдача: товар приходит сразу после оплаты">${BOLT}Автовыдача</span>`;
{ const _cb = cardBadge; cardBadge = function (l) { return (l && l.auto_delivery && (l.stock == null || l.stock > 0) ? autoBadge() : "") + _cb(l) } }

// ---- форма лота: блок «Автовыдача»
window._auto = null;
const autoBtn = `<button type="button" class="abtn" id="abtn" onclick="autoOpen()"><i>${BOLT}</i><span><b id="abt">Включить автовыдачу</b><small id="abs">Покупатель получит данные в чат сразу после оплаты</small></span></button>`;
const autoBlock = () => `<div class="card lf" id="autoc"><div class="lsec">Автовыдача</div>${autoBtn}</div>`;
function autoPaint() {
  const a = window._auto, n = a && a.items ? a.items.length : 0, b = document.getElementById("abtn"); if (!b) return;
  b.classList.toggle("on", n > 0);
  document.getElementById("abt").textContent = n ? "Автовыдача включена" : "Включить автовыдачу";
  document.getElementById("abs").textContent = n ? `Готово к выдаче: ${n} шт. Нажмите, чтобы изменить` : "Покупатель получит данные в чат сразу после оплаты";
  const ss = document.getElementById("ss"); if (ss) { if (n) { ss.value = n; ss.disabled = true } else ss.disabled = false }
  if (typeof pvw === "function") try { pvw() } catch { }
  if (typeof feeBox === "function") feeBox();
}
function autoOpen() {
  const a = window._auto, v = a && a.items ? a.items.join("\n") : "";
  mdl(`<h3 style="margin:0 0 6px">Автовыдача</h3><p class="m" style="margin:0 0 10px">Впишите данные, которые получит покупатель сразу после оплаты: логин и пароль, ключ, ссылку. <b>Одна строка: одна покупка.</b> Остаток лота станет равен числу строк, а после каждой продажи выданная строка удаляется.</p><textarea id="ait" rows="8" maxlength="30000" placeholder="login1:password1&#10;login2:password2&#10;XXXXX-XXXXX-XXXXX" style="font-family:ui-monospace,monospace;font-size:13px">${esc(v)}</textarea><div class="hint" id="aic">Строк: 0</div><p class="m" style="margin:8px 0"><small>Данные видят только вы и покупатель после оплаты. В описании и названии их не пишите: они публичные. До 100 строк, до 250 символов в строке.</small></p><button class="btn pri big" style="width:100%" onclick="autoSave()">Сохранить</button>${v ? `<button class="btn dng" style="width:100%;margin-top:8px" onclick="autoOff()">Выключить автовыдачу</button>` : ""}`);
  const t = document.getElementById("ait"), c = () => { const k = t.value.split(/\r?\n/).filter(x => x.trim()).length; document.getElementById("aic").textContent = "Строк: " + k }; t.addEventListener("input", c); c();
}
function autoSave() {
  const items = document.getElementById("ait").value.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  if (!items.length) return autoOff();
  if (items.length > 100) return toast("Не больше 100 строк за раз");
  if (items.some(x => x.length > 250)) return toast("Одна строка не длиннее 250 символов");
  window._auto = { items }; document.getElementById("md")?.remove(); autoPaint(); toast("Автовыдача включена")
}
function autoOff() { window._auto = { items: null }; document.getElementById("md")?.remove(); autoPaint(); toast("Автовыдача выключена") }
const AFORM = '<label class="chk"><input type="checkbox" id="sgp"';
{
  const _sell = sell, _edit = editPage, put = h => h.includes('<div class="card lf"><div class="lsec">Изображение') ? h.replace('<div class="card lf"><div class="lsec">Изображение', autoBlock() + '<div class="card lf"><div class="lsec">Изображение') : h.replace(/(<label class="chk">\s*<input type="checkbox" id="sds")/, `<div class="lsec" style="margin-top:14px">Автовыдача</div>${autoBtn}` + "$1");
  sell = async function () { window._auto = null; const h = put(await _sell.apply(this, arguments)); setTimeout(autoPaint, 30); return h };
  editPage = async function (id) { const h = await _edit.apply(this, arguments); let l = null; try { l = await api("/listings/" + id) } catch { } window._auto = l && l.auto_items && l.auto_items.length ? { items: l.auto_items.slice() } : { items: null }; setTimeout(autoPaint, 30); return put(h) };
}

// ---- чат: не прыгает, пока человек читает историю
const nearBot = b => b.scrollHeight - b.scrollTop - b.clientHeight < 90;
document.addEventListener("scroll", e => { const b = e.target; if (b && b.id && (b.id === "chm" || b.id === "otl")) b._stick = nearBot(b) }, true);
document.addEventListener("load", e => { const im = e.target; if (im && im.tagName === "IMG") { const b = im.closest && im.closest("#chm,#otl"); if (b && b._stick !== false) b.scrollTop = 1e9 } }, true);
addMsg = function (m) {
  const b = document.getElementById("chm"); if (!b || document.getElementById("m" + m.id)) return;
  const stick = b._stick !== false && nearBot(b) || (ME && m.sender_id === ME.id);
  b.querySelector(".emp")?.remove(); b.insertAdjacentHTML("beforeend", bub(m)); if (stick) { b.scrollTop = 1e9; b._stick = true }
};
// после открытия диалога или заказа лента внизу, даже если картинки догружаются позже
{ const ar = window.afterRoute; window.afterRoute = function () { const r = ar && ar.apply(this, arguments); setTimeout(() => { for (const id of ["chm", "otl"]) { const b = document.getElementById(id); if (b) { b._stick = true; b.scrollTop = 1e9 } } }, 60); return r } }

// ---- финансы: новый вид
const FK = {
  test_topup: ["Пополнение", "Тестовый баланс", "in"], topup: ["Пополнение", "Баланс", "in"],
  order_payment: o => ["Покупка", "Заказ #" + (o.order_number || ""), "out"], order_payout: o => ["Продажа", "Заказ #" + (o.order_number || ""), "in"],
  refund: o => ["Возврат", "Заказ #" + (o.order_number || ""), "in"], withdraw: o => ["Вывод", { pending: "В обработке", paid: "Выплачено", rejected: "Отклонено" }[o.w_status] || "В обработке", "wd"],
  withdraw_refund: ["Возврат вывода", "Заявка отклонена", "in"], adjustment: ["Корректировка", "От администрации", "in"]
};
const FIC = { in: "M12 4v12m0 0-5-5m5 5 5-5M5 20h14", out: "M12 20V8m0 0-5 5m5-5 5 5M5 4h14", wd: "M4 7h16v10H4zM4 11h16M8 15h3" };
const finIc = k => `<span class="fi2 ${k}"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${FIC[k]}"/></svg></span>`;
const dayLbl = d => { const x = new Date(d), t = new Date(), y = new Date(Date.now() - 864e5), same = (a, b) => a.toDateString() === b.toDateString(); return same(x, t) ? "Сегодня" : same(x, y) ? "Вчера" : x.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: x.getFullYear() === t.getFullYear() ? undefined : "numeric" }) };
financePage = async function () {
  need(); const type = new URLSearchParams(location.hash.split("?")[1] || "").get("type") || "all", d = await api("/finance?type=" + type), tt = d.totals || {};
  const tabs = [["all", "Все"], ["in", "Доходы"], ["out", "Траты"], ["withdraw", "Выводы"]];
  let last = "", rows = d.ops.map(o => {
    const k = FK[o.kind], f = typeof k === "function" ? k(o) : k || [o.kind, "", "in"], day = dayLbl(o.created_at), head = day !== last ? `<div class="fdg">${day}</div>` : ""; last = day;
    const wait = o.kind === "withdraw" && (!o.w_status || o.w_status === "pending"), neg = o.amount < 0;
    return `${head}<div class="fo ${wait ? "wait" : ""}" ${o.ref_type === "order" ? `onclick="go('/orders')"` : ""}>${finIc(f[2])}<div class="fob"><b>${esc(f[0])}</b><small>${esc(f[1])} · ${new Date(o.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</small></div><b class="foa ${neg ? "neg" : "pos"}">${neg ? "−" : "+"}${fm(Math.abs(o.amount))}</b></div>`
  }).join("") || empty("Операций пока нет.");
  return `<h2 style="margin-bottom:10px">Финансы</h2>
<div class="fhero"><div class="fht"><small>Доступно</small>${d.test_mode ? `<span class="tag">Тестовый баланс</span>` : ""}</div><div class="fhb">${fm(d.balance)}</div><div class="fha">${d.test_mode ? `<button class="btn" onclick="topupForm()">Пополнить</button>` : `<button class="btn" disabled>Пополнить</button>`}<button class="btn pri" onclick="withdrawForm(${d.balance})">Вывести</button></div>${d.test_mode ? "" : `<small class="m">Пополнение пока недоступно: платёжный способ не подключён.</small>`}</div>
<div class="fts"><div><small>Поступило</small><b class="pos">${fm(tt.in || 0)}</b></div><div><small>Потрачено</small><b>${fm(tt.out || 0)}</b></div><div><small>На выводе</small><b>${fm(tt.pending || 0)}</b></div></div>
${d.test_mode ? `<p class="m fnote">Баланс и комиссии тестовые: реальные деньги не принимаются и не выплачиваются.</p>` : ""}
<div class="ftabs">${tabs.map(t => `<a class="${type === t[0] ? "on" : ""}" onclick="go('/finance?type=${t[0]}')">${t[1]}</a>`).join("")}</div><div class="flist">${rows}</div>`;
};
