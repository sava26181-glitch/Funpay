// v4: новости, час распродажи, кодекс продавца, битвы магазинов, совместная покупка, личный чат
Object.assign(ERR, {
  "not enough funds": "Недостаточно средств на балансе. Пополните баланс в разделе «Финансы»", "test top-up disabled": "Тестовое пополнение отключено", "amount 10-50000": "Сумма пополнения: от 10 до 50 000 ₽", "too many top-ups": "Слишком много пополнений за час, попробуйте позже", "amount 10-500000": "Сумма вывода: от 10 до 500 000 ₽", "details 3-200 chars": "Укажите реквизиты (3–200 символов)", "bad method": "Выберите способ вывода", "order is not awaiting payment": "Заказ уже не ждёт оплаты", "balance payment is not available for group orders yet": "Для совместных заказов оплата с баланса пока недоступна", "already processed": "Заявка уже обработана",
  "sign seller code first": "Сначала подпишите Кодекс продавца", "code burned": "Кодекс сгорел, подписать его повторно нельзя", "agree required": "Нужно согласие с Кодексом",
  "sale already active": "На этот лот уже идёт распродажа", "cooldown 6h": "Повторно запустить распродажу на этот лот можно через 6 часов", "too many active sales": "Одновременно можно держать не больше 3 распродаж",
  "listing not active": "Лот должен быть опубликован", "no stock": "Нет товара в наличии", "no active sale": "Активной распродажи нет",
  "group buy not allowed": "Продавец не разрешил совместную покупку этого лота", "total too small for group buy": "Совместная покупка доступна для заказов от 1 000 ₽",
  "too many open invites": "Слишком много открытых приглашений (максимум 5)", "invite closed": "Приглашение уже закрыто", "invite expired": "Срок приглашения истёк", "own invite": "Это ваше приглашение",
  "need active listing in category": "Чтобы участвовать, нужен опубликованный лот в этой категории", "user not found": "Пользователь не найден", "own profile": "Это ваш профиль",
  "too many new chats": "Слишком много новых чатов за час, попробуйте позже", "cannot mark staff": "Нельзя ставить пометки сотрудникам", "reason 5-500 chars": "Причина: от 5 до 500 символов"
});
const IC4 = {
  shield: "M12 2l8 3v6c0 5-3.400 9.400-8 11-4.600-1.600-8-6-8-11V5z",
  bolt: "M13.500 2L4 14h6.500L9.500 22 20 9.500h-6.600z",
  swords: "M19.780 4.220L18.360 8.460 11.290 15.540 8.460 12.710 15.540 5.640zM5.640 9.880L14.120 18.360 12.350 20.130 3.870 11.650zM7.400 15.180L8.820 16.600 6.340 19.070 4.930 17.660zM3.300 19.300a1.400 1.400 0 1 0 2.800 0a1.400 1.400 0 1 0-2.800 0z",
  box: "M12 2L3 6.500v11L12 22l9-4.500v-11zM12 4.300l5.800 2.900L12 10 6.200 7.200zM5 8.800l6 3v7.400l-6-3zm14 0v7.400l-6 3v-7.400z",
  users: "M9 11a4 4 0 100-8 4 4 0 000 8zm8 0a3 3 0 100-6 3 3 0 000 6zM2 21a7 7 0 0114 0zm15-6a6 6 0 015 6h-5z",
  news: "M4 4h13v16H6a2 2 0 01-2-2zm13 3h3v11a2 2 0 01-2 2h-1zM7 8h7v2H7zm0 4h7v2H7z",
  trophy: "M7 3h10v5a5 5 0 01-10 0zM4.500 4H2v2.500A3.500 3.500 0 005.500 10M19.500 4H22v2.500a3.500 3.500 0 01-3.500 3.500M11 14h2v4h3.500v3h-9v-3H11z"
};
const ic4 = (k, s = 16) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="currentColor" aria-hidden="true" style="flex:none"><path d="${IC4[k]}"/></svg>`;
const fmtD = d => new Date(d).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });

// ---- таймеры
const cdFmt = ms => { const s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return (h ? h + ":" : "") + String(m).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0") };
function tick() { document.querySelectorAll("[data-end]").forEach(e => { const d = new Date(e.dataset.end) - Date.now(); if (d <= 0) { if (!e.dataset.done) { e.dataset.done = 1; e.textContent = "завершено"; e.closest(".fsl,.flb,.fcard")?.classList.add("end") } } else { e.textContent = cdFmt(d); delete e.dataset.done; e.closest(".fsl,.flb,.fcard")?.classList.remove("end") } }) }
setInterval(tick, 1000);

// ---- цены и метки
function pr(l) { return l.sale_cents && l.sale_ends ? `<span class="prs"><s class="old">${rub(l.price_cents)}</s><b class="price">${rub(l.sale_cents)}</b></span>` : `<b class="price">${rub(l.price_cents)}</b>` }
function saleTag(l) { return l.sale_cents && l.sale_ends ? `<span class="fsl">${ic4("bolt", 12)}−${l.sale_percent}% · <i data-end="${l.sale_ends}">--:--</i></span>` : "" }
function cmk(s) {
  if (s === "scam") return `<span class="cmk s" title="Помечен как скам">скам</span>`;
  if (s === "violation") return `<span class="cmk v" title="Нарушил Кодекс продавца">нарушил кодекс</span>`;
  if (s === "ok") return `<span class="cmk ok" title="Подписал Кодекс продавца" aria-label="Подписал Кодекс продавца">${ic4("shield", 13)}</span>`;
  return "";
}
function lbx(src) { const o = document.createElement("div"); o.className = "lbx"; o.onclick = () => o.remove(); o.innerHTML = `<img src="${src}" alt="">`; document.body.append(o) }

// ---- главная
function flashBlock(fl) {
  const head = `<div class="row bet"><h2 class="h2i">${ic4("bolt", 20)}Час распродажи</h2></div>`;
  if (!fl.length) return `${head}<div class="card m" style="margin-bottom:var(--gap)">Сейчас нет активных распродаж. Продавец может запустить её на 30–60 минут для любого опубликованного лота в разделе «Мои объявления».</div>`;
  return `${head}<div class="fscr">${fl.map(l => `<div class="fcard" onclick="go('/l/${l.id}')"><span class="fsl">${ic4("bolt", 12)}−${l.sale_percent}% · <i data-end="${l.sale_ends}">--:--</i></span><div class="m">${esc(l.game_name)}</div><b class="t">${esc(l.title)}</b><div class="fp"><s class="old">${rub(l.price_cents)}</s><b class="price">${rub(l.sale_cents)}</b></div><small class="m">${esc(l.seller)}${cmk(l.code_state)}</small></div>`).join("")}</div>`;
}
function newsList(ns) {
  if (!ns.length) return empty("Новостей пока нет.");
  return ns.map(n => `<article class="news"><div class="row bet"><b class="nt">${esc(n.title)}</b>${isAdm() ? `<span class="row" style="gap:6px"><button class="btn sm" onclick="newsEdit('${n.id}')">Изменить</button><button class="btn sm dng" onclick="newsDel('${n.id}')" aria-label="Удалить новость">Удалить</button></span>` : ""}</div><small class="m">${fmtD(n.created_at)}${n.author ? " · " + esc(n.author) : ""}</small>${(n.media_ids || []).length ? `<div class="nph n${Math.min(n.media_ids.length, 3)}">${n.media_ids.map(id => `<img loading="lazy" src="/api/media/${id}" alt="" onclick="lbx(this.src)">`).join("")}</div>` : ""}${n.body ? `<p class="nb">${esc(n.body)}</p>` : ""}<a class="lk ncb" id="ncb-${n.id}" onclick="ncToggle('${n.id}')">Комментарии (${n.comments || 0})</a><div class="ncs" id="nc-${n.id}" hidden></div></article>`).join("");
}
const NCN = {};
async function ncToggle(id) {
  const box = $("#nc-" + id); if (!box) return;
  if (!box.hidden) { box.hidden = true; return }
  box.hidden = false; box.innerHTML = '<span class="m">Загрузка...</span>';
  try { await ncLoad(id) } catch (e) { box.innerHTML = `<span class="m">${esc(e.message)}</span>` }
}
async function ncLoad(id) {
  const box = $("#nc-" + id), cs = await api(`/news/${id}/comments`); NCN[id] = cs.length;
  const b = $("#ncb-" + id); if (b) b.textContent = `Комментарии (${cs.length})`;
  box.innerHTML = (cs.map(c => `<div class="nci">${avs(c.username, c.avatar_media, false, c.avatar_preset)}<div class="fb"><div class="mh"><b>${esc(c.username)}</b>${c.role ? `<span class="tag">${c.role === "moderator" ? "Модератор" : "Админ"}</span>` : ""}<time>${fmtD(c.created_at)}</time>${ME && (ME.username === c.username || ["moderator", "admin", "owner"].includes(ME.role)) ? `<a class="lk" onclick="ncDel('${c.id}','${id}')">удалить</a>` : ""}</div><div class="bt">${esc(c.body)}</div></div></div>`).join("") || '<span class="m">Комментариев пока нет.</span>')
    + (ME ? `<div class="cmp cmp2"><input id="ni-${id}" maxlength="500" placeholder="Написать комментарий..." enterkeyhint="send" onkeydown="if(event.key==='Enter')ncSend('${id}')"><button class="ib2 pri" onclick="ncSend('${id}')" aria-label="Отправить">${ic4n("arr")}</button></div>` : `<a class="lk" onclick="NEXT='/';go('/login')">Войдите, чтобы комментировать</a>`);
}
const ic4n = () => `<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;
const ncSend = act(async id => { if (window._ncs) return; const el = $("#ni-" + id), v = el.value.trim(); if (!v) return; window._ncs = 1; el.value = ""; try { await api(`/news/${id}/comments`, { method: "POST", body: { body: v } }); await ncLoad(id); $("#ni-" + id)?.focus() } catch (e) { el.value = v; throw e } finally { window._ncs = 0 } });
const ncDel = act(async (cid, id) => { await api("/news/comments/" + cid, { method: "DELETE" }); await ncLoad(id) });
async function home() {
  const news = await api("/news?limit=10").catch(() => []);
  setTimeout(tick, 0);
  return `<section class="promo"><div class="pl">${logo(76)}<h1>Всё для твоих любимых игр</h1></div><p>Находи игровые товары и услуги в одном месте.</p><button class="btn pri big" onclick="go('/games')">Перейти к покупкам</button></section>
<div class="qk"><a onclick="go('/battles')">${ic4("swords", 20)}<b>Дуэли магазинов</b><small>24 часа, призы</small></a><a onclick="go('/code')">${ic4("shield", 20)}<b>Кодекс продавца</b><small>Честные правила</small></a></div>
<div class="row bet" style="margin-top:var(--gap)"><h2 class="h2i">${ic4("news", 20)}Новости</h2>${isAdm() ? '<button class="btn sm pri" onclick="newsForm()">Добавить новость</button>' : ""}</div><div class="nws">${newsList(news)}</div>`;
}
function newsForm() {
  mdl(`<h3 style="margin-top:0">Новая новость</h3><label>Заголовок</label><input id="nt" maxlength="120"><label>Текст</label><textarea id="nb" rows="5" maxlength="4000"></textarea><label>Фото (до 6)</label><input id="nf" type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif"><div class="hint">png, jpeg, webp или gif до 2 МБ каждое</div><button class="btn pri" style="margin-top:10px;width:100%" onclick="newsSave(this)">Опубликовать</button>`);
}
const newsSave = act(async btn => {
  const t = $("#nt").value.trim(); if (t.length < 3) throw new Error("Заголовок: минимум 3 символа");
  const fs = [...$("#nf").files].slice(0, 6); btn.disabled = true; btn.textContent = "Загружаю…";
  try { const ids = []; for (const f of fs) ids.push(await upload(f, "news")); await api("/admin/news", { method: "POST", body: { title: t, body: $("#nb").value, media: ids } }); $("#md")?.remove(); toast("Новость опубликована"); route() }
  catch (e) { btn.disabled = false; btn.textContent = "Опубликовать"; throw e }
});
function ask(msg, label, fn) { window._ask = fn; mdl(`<p style="margin:0 0 12px">${msg}</p><button class="btn dng" style="width:100%" onclick="$('#md').remove();_ask()">${label}</button>`) }
const newsDel = id => ask("Удалить эту новость? Действие нельзя отменить.", "Удалить", act(async () => { await api("/admin/news/" + id, { method: "DELETE" }); toast("Новость удалена"); route() }));

// ---- час распродажи (продавец)
let MYFL = [];
const myFl = id => { const f = MYFL.find(x => x.listing_id === id); return f ? ` · <span class="fsl">${ic4("bolt", 12)}−${f.percent}% · <i data-end="${f.ends_at}">--:--</i></span>` : "" };
const flBtn = l => `<button class="btn sm" onclick="cardForm('${l.id}')">Оформление карточки</button>`;
function flashForm(id) {
  mdl(`<h3 style="margin-top:0">Час распродажи</h3><p class="m" style="margin-top:0">Цена лота временно снизится, а лот появится на главной с таймером. Покупатели, у которых лот в избранном, получат уведомление.</p><label>Длительность</label><select id="fm"><option value="30">30 минут</option><option value="45">45 минут</option><option value="60">60 минут</option></select><label>Скидка</label><select id="fp">${[10, 15, 20, 25, 30, 40, 50].map(p => `<option value="${p}">${p}%</option>`).join("")}</select><p class="m"><small>Если во время распродажи изменить цену лота, скидка закончится. Повторный запуск на тот же лот возможен через 6 часов, одновременно не больше 3 распродаж.</small></p><button class="btn pri" style="width:100%" onclick="flStart('${id}')">Запустить</button>`);
}
const flStart = act(async id => { await api("/flash", { method: "POST", body: { listingId: id, minutes: +$("#fm").value, percent: +$("#fp").value } }); $("#md")?.remove(); toast("Распродажа запущена"); route() });
const flStop = act(async id => { await api("/flash/" + id, { method: "DELETE" }); toast("Распродажа остановлена"); route() });

// ---- кодекс продавца
const RULES4 = [["Не обманывать", "Не брать оплату без выдачи товара и не пропадать после оплаты."], ["Выдавать в срок", "Выдавать товар в срок, который указан в объявлении."], ["Отвечать вежливо", "Отвечать покупателям уважительно, без грубости и давления."]];
const rulesHtml = rs => `<ol class="rules">${rs.map(r => `<li><b>${esc(r.title || r[0])}</b><span>${esc(r.text || r[1])}</span></li>`).join("")}</ol>`;
async function codeRules() { let rs = RULES4; try { rs = (await api("/seller-code")).rules } catch { } mdl(`<h3 style="margin-top:0">Кодекс продавца</h3>${rulesHtml(rs)}<p class="m"><small>Нарушение сжигает кодекс, и пометка видна всем. За скам аккаунт блокируется сразу.</small></p>`) }
async function codePage() {
  const c = await api("/seller-code"), m = c.mine;
  let st = "";
  if (!ME) st = `<button class="btn pri big" style="width:100%" onclick="NEXT='/code';go('/login')">Войдите, чтобы подписать</button>`;
  else if (m && m.state === "ok") st = `<div class="card cok">${ic4("shield", 20)}<div><b>Вы подписали кодекс</b><div class="m">${fmtD(m.signed_at)}. Его видят все на вашем профиле и в ваших объявлениях.</div></div></div><div class="row"><button class="btn pri" onclick="go('/sell')">Создать объявление</button><button class="btn" onclick="go('/my')">Мои объявления</button></div>`;
  else if (m) st = `<div class="card cbad"><b>${m.state === "scam" ? "Вы помечены как скам" : "Ваш кодекс сгорел"}</b><div class="m">${esc(m.reason || "")}</div><div class="m"><small>Подписать кодекс повторно нельзя. Если это ошибка, напишите в поддержку.</small></div></div>`;
  else st = `<label class="chk"><input type="checkbox" id="cag"> <span>Я прочитал(а) кодекс и обязуюсь его соблюдать. Я понимаю, что при нарушении кодекс сгорит и пометка станет публичной.</span></label><button class="btn pri big" style="width:100%;margin-top:12px" onclick="codeSign()">Подписать и стать продавцом</button>`;
  return `<h2 class="h2i">${ic4("shield", 20)}Кодекс продавца</h2><p class="m" style="margin-top:0">Продавец публично берёт на себя обязательства. Репутация строится не на словах, а на правилах, которые видны каждому покупателю.</p>${rulesHtml(c.rules)}<div class="card"><b>Что бывает за нарушение</b><ul class="m" style="margin:6px 0 0;padding-left:18px"><li>Нарушил правило: кодекс сгорает, рядом с ником появляется пометка «нарушил кодекс», причину видят все.</li><li>Скам: аккаунт блокируется сразу, объявления снимаются, рядом с ником остаётся пометка «скам».</li></ul></div>${st}`;
}
const codeSign = act(async () => { if (!$("#cag")?.checked) throw new Error("Подтвердите согласие с кодексом"); await api("/seller-code/sign", { method: "POST", body: { agree: true } }); ME = await api("/me"); toast("Кодекс подписан"); go("/") });
function codeGate(c) { const m = c.mine; if (m && m.state !== "ok") return `<h2>Продажа</h2><div class="card cbad"><b>${m.state === "scam" ? "Аккаунт помечен как скам" : "Ваш кодекс сгорел"}</b><div class="m">Публиковать объявления нельзя.</div></div>`; return `<h2>Продажа</h2><div class="card"><p style="margin-top:0">Чтобы публиковать объявления, подпишите публичный Кодекс продавца.</p><button class="btn pri" onclick="go('/code')">Открыть кодекс</button></div>` }
const _sell = sell;
sell = async function () { need(); const c = await api("/seller-code"); if (!c.mine || c.mine.state !== "ok") return codeGate(c); return _sell() };

function codeCard(cs, u) {
  if (!cs || !cs.state) return u.is_seller ? `<div class="cpill no"><span>Кодекс продавца не подписан</span></div>` : "";
  if (cs.state === "ok") return `<div class="cpill" onclick="codeRules()" role="button">${ic4("shield", 13)}<span>Кодекс продавца подписан · с ${fmtD(cs.signed_at)}</span></div>`;
  return `<div class="card cbad"><b>${cs.state === "scam" ? "Помечен как скам" : "Нарушил Кодекс продавца"}</b><div class="m">${esc(cs.reason || "")}</div><small class="m">${cs.revoked_at ? fmtD(cs.revoked_at) + ". " : ""}${cs.state === "scam" ? "Аккаунт заблокирован." : "Кодекс сгорел, доверяйте с осторожностью."}</small></div>`;
}
function staffCode(u, cs) {
  const st = cs && cs.state, adm = isAdm();
  return `${st === "ok" || !st ? `<button class="btn sm dng" onclick="codeAct('${u.id}','burn')">Сжечь кодекс</button>` : ""}${adm && st !== "scam" ? `<button class="btn sm dng" onclick="codeAct('${u.id}','scam')">Скам</button>` : ""}${adm && (st === "violation" || st === "scam") ? `<button class="btn sm" onclick="codeAct('${u.id}','restore')">Снять пометку</button>` : ""}${adm ? `<button class="btn sm" onclick="pwCode('${esc(u.username)}')">Код сброса пароля</button>` : ""}`;
}
function codeAct(id, kind) {
  if (kind === "restore") return ask("Снять пометку и вернуть кодекс?", "Снять пометку", () => codeGo(id, kind, ""));
  mdl(`<h3 style="margin-top:0">${kind === "scam" ? "Пометить как скам" : "Сжечь кодекс"}</h3><p class="m" style="margin-top:0">${kind === "scam" ? "Аккаунт будет заблокирован, объявления сняты." : "Рядом с ником появится пометка «нарушил кодекс»."} Причину увидят все, пишите по делу.</p><textarea id="cre" rows="3" maxlength="500" placeholder="Причина (от 5 символов)"></textarea><button class="btn dng" style="margin-top:10px;width:100%" onclick="codeGo('${id}','${kind}',$('#cre').value)">Подтвердить</button>`);
}
const codeGo = act(async (id, kind, reason) => { await api(`/admin/seller-code/${id}/${kind}`, { method: "POST", body: { reason } }); $("#md")?.remove(); toast("Готово"); route() });

// ---- личный чат из профиля
const dm = act(async n => { if (!ME) { NEXT = location.hash.slice(1); go("/login"); return } const c = await api("/conversations", { method: "POST", body: { username: n } }); go("/chat/" + c.id) });

// ---- битвы магазинов
async function battlesPage() {
  const d = await api("/battles"), mine = new Set(d.mine);
  const live = d.live.map(b => { const t = b.score_a + b.score_b, pa = t ? Math.round(b.score_a / t * 100) : 50; return `<div class="card bt"><div class="row bet"><span class="tag">${esc(b.category_name)}</span><small class="m">до ${fmtD(b.week_end)}</small></div><div class="bv"><a onclick="go('/u/${encodeURIComponent(b.name_a)}')"><b>${esc(b.name_a)}</b></a><span class="sc">${b.score_a}<i>:</i>${b.score_b}</span><a onclick="go('/u/${encodeURIComponent(b.name_b)}')"><b>${esc(b.name_b)}</b></a></div><div class="bbar"><u style="width:${pa}%"></u></div></div>` }).join("");
  const done = d.done.map(b => `<div class="card row bet"><span style="display:flex;gap:8px;align-items:center">${ic4("trophy", 18)}<a onclick="go('/u/${encodeURIComponent(b.winner_id === b.seller_a ? b.name_a : b.name_b)}')"><b>${esc(b.winner_id === b.seller_a ? b.name_a : b.name_b)}</b></a></span><small class="m">${esc(b.category_name)} · ${b.score_a}:${b.score_b} · ${fmtD(b.finished_at)}</small></div>`).join("");
  const part = !ME ? `<button class="btn pri" onclick="NEXT='/battles';go('/login')">Войдите, чтобы участвовать</button>` : !ME.is_seller ? `<p class="m">Участвовать могут продавцы с подписанным кодексом.</p><button class="btn" onclick="go('/code')">Стать продавцом</button>` : `<div class="chips">${d.categories.map(c => mine.has(c.id) ? `<button class="btn sm pri" onclick="btLeave('${c.id}')">${esc(c.name)} · выйти</button>` : `<button class="btn sm" onclick="btJoin('${c.id}')">${esc(c.name)}</button>`).join("")}</div><p class="m"><small>Нужен хотя бы один опубликованный лот в категории. Пары собираются из записавшихся продавцов одной категории.</small></p>`;
  return `<h2 class="h2i">${ic4("swords", 20)}Битвы магазинов</h2><p class="m" style="margin-top:0">Дуэль двух магазинов одной категории: кто за неделю закроет больше заказов, тот побеждает.</p><div class="card"><b>Как это работает</b><ol class="m" style="margin:8px 0 0;padding-left:20px;line-height:1.6"><li><b>Запись.</b> Продавец с подписанным кодексом и хотя бы одним лотом записывается в категорию (кнопки в разделе «Участие» ниже).</li><li><b>Подбор пары.</b> В начале недели система соединяет записавшихся в категории по двое. Если участников нечётное число, один остаётся без пары до следующей недели.</li><li><b>Счёт.</b> Очко даёт каждый заказ со статусом «Завершён»: покупатель получил товар и подтвердил. Оплаченные, но не завершённые заказы не считаются.</li><li><b>Шкала.</b> На карточке дуэли полоса показывает долю очков каждого магазина, число слева и справа это счёт.</li><li><b>Итог.</b> В конце недели у кого больше очков, тот победитель и получает значок «Победитель недели» на 7 дней. При равном счёте победителя нет.</li></ol><p class="m" style="margin:10px 0 0"><small>Денежные призы, снижение комиссии и продвижение лотов пока не подключены, сейчас награда только значок.</small></p></div><h3>Идут сейчас</h3>${live || empty("Пока нет активных битв. Битва начинается, когда в категории записались минимум два продавца.")}<h3>Победители</h3>${done || empty("Завершённых битв с победителем пока нет.")}<h3>Участие</h3><div class="card">${part}</div>`;
}
const btJoin = act(async id => { await api("/battles/join", { method: "POST", body: { categoryId: id } }); toast("Вы записаны"); route() });
const btLeave = act(async id => { await api("/battles/leave", { method: "POST", body: { categoryId: id } }); toast("Вы вышли"); route() });

// ---- совместная покупка
function groupForm(id, unit, stock) {
  if (!ME) { NEXT = location.hash.slice(1); go("/login"); return }
  window._gu = unit; window._gs = stock;
  mdl(`<h3 style="margin-top:0">Купить вдвоём</h3><p class="m" style="margin-top:0">Вы создаёте приглашение для второго покупателя. Он присоединяется по ссылке, и тогда создаётся один заказ с разделёнными долями. Приглашение действует 24 часа.</p><label>Количество</label><input id="gq" type="number" min="1" max="${stock}" value="1" inputmode="numeric" oninput="gcalc()"><label>Ваша доля</label><select id="gp" onchange="gcalc()">${[30, 40, 50, 60, 70].map(p => `<option value="${p}" ${p === 50 ? "selected" : ""}>${p}%</option>`).join("")}</select><div class="gsum" id="gs"></div><label>Условия (необязательно)</label><textarea id="gt" rows="3" maxlength="500" placeholder="Например: аккаунт делим по очереди, пароль меняем вместе"></textarea><p class="m"><small>Оплата пока не подключена: сейчас фиксируются только условия и доли, деньги не списываются.</small></p><button class="btn pri" style="width:100%" onclick="groupMake('${id}')">Создать приглашение</button>`);
  gcalc();
}
function gcalc() { const q = Math.max(1, Math.min(window._gs, Math.floor(+$("#gq").value || 1))), p = +$("#gp").value, t = window._gu * q, a = Math.round(t * p / 100); $("#gs").innerHTML = `<div><small class="m">Всего</small><b>${rub(t)}</b></div><div><small class="m">Вы</small><b>${rub(a)}</b></div><div><small class="m">Партнёр</small><b>${rub(t - a)}</b></div>${t < 1e5 ? '<div class="gw">От 1 000 ₽ за заказ</div>' : ""}` }
const groupMake = act(async id => { const g = await api("/groups", { method: "POST", body: { listingId: id, qty: Math.max(1, Math.floor(+$("#gq").value || 1)), pct: +$("#gp").value, terms: $("#gt").value } }); $("#md")?.remove(); go("/g/" + g.id) });
async function groupPage(id) {
  const g = await api("/groups/" + id), me = ME && ME.id === g.initiator_id, seller = ME && ME.username === g.seller, open = g.status === "open" && !g.expired;
  const ST4 = { open: "Ждёт партнёра", ordered: "Заказ создан", cancelled: "Отменено", expired: "Срок истёк" };
  const act4 = !ME ? `<button class="btn pri big" style="width:100%" onclick="NEXT=location.hash.slice(1);go('/login')">Войдите, чтобы присоединиться</button>` : !open ? (g.status === "ordered" ? `<button class="btn pri" onclick="go('/orders')">К заказам</button>` : "") : me ? `<button class="btn" onclick="copyText(location.href)">Скопировать ссылку</button><button class="btn dng" onclick="groupCancel('${g.id}')">Отменить</button>` : seller ? '<p class="m">Это ваш лот.</p>' : `<button class="btn pri big" style="width:100%" onclick="groupJoin('${g.id}')">Присоединиться и принять условия</button>`;
  setTimeout(tick, 0);
  return `<div class="row bet" style="margin:12px 0"><a class="bk" onclick="go('/l/${g.listing_id}')">‹</a><h1 style="font-size:19px;flex:1" class="h2i">${ic4("users", 20)}Совместная покупка</h1></div><div class="card"><b style="overflow-wrap:anywhere">${esc(g.title)}${g.qty > 1 ? " ×" + g.qty : ""}</b><div class="m">Продавец: ${esc(g.seller)}</div><div class="gsum"><div><small class="m">Всего</small><b>${rub(g.total_cents)}</b></div><div><small class="m">${esc(g.initiator)}</small><b>${rub(g.initiator_cents)}</b></div><div><small class="m">${g.partner ? esc(g.partner) : "Партнёр"}</small><b>${rub(g.partner_cents)}</b></div></div><div class="row bet"><span class="tag">${ST4[g.expired ? "expired" : g.status]}</span>${open ? `<small class="m">осталось <i data-end="${g.expires_at}">--:--</i></small>` : ""}</div></div>${g.terms ? `<div class="card"><small class="m">Условия</small><p style="margin:4px 0 0;white-space:pre-wrap;overflow-wrap:anywhere">${esc(g.terms)}</p></div>` : ""}<p class="m"><small>Заказ оформляется на ${esc(g.initiator)}, партнёр видит его в своих покупках. Оплата пока не подключена: деньги не списываются и не удерживаются, фиксируются только условия и доли.</small></p><div class="row">${act4}</div>`;
}
function copyText(t) { (navigator.clipboard?.writeText(t) || Promise.reject()).then(() => toast("Скопировано")).catch(() => toast("Скопируйте адрес из строки браузера")) }
const groupJoin = id => ask("Принять условия и присоединиться? Будет создан заказ, деньги не списываются: оплата не подключена.", "Присоединиться", act(async () => { await api(`/groups/${id}/join`, { method: "POST" }); toast("Вы присоединились"); go("/orders") }));
const groupCancel = act(async id => { await api(`/groups/${id}/cancel`, { method: "POST" }); toast("Отменено"); route() });

// ---- ачивки: кнопка под рамкой профиля справа
function achBtn(u) { const p = u.progress; if (!p) return ""; window._achU = u; const n = [p.deals, p.fast, p.top].filter(x => x.earned).length; return `<button class="btn sm achbtn" onclick="achOpen()">${ic4("trophy", 14)} Ачивки ${n}/3</button>` }
function achOpen() { mdl(`<h3 style="margin-top:0">Ачивки</h3>${achBlock(window._achU)}`) }

// ---- номер заказа в системном сообщении кликабелен: ведёт на настоящую страницу заказа (защита от подделок в чате)
function ordLink(h, oid) { return h.replace(/#([0-9A-Fa-f]{6,12})/g, (x, n) => `<a class="onum" onclick="event.stopPropagation();goOrd('${oid || ""}','${n}')">${x}</a>`) }
function goOrd(oid, n) {
  const staff = typeof isStaff === "function" && isStaff();
  const adm = () => go("/admin?tab=orders&q=" + encodeURIComponent(n));
  const byNum = () => api("/orders/by-number/" + encodeURIComponent(n)).then(r => go("/order/" + r.id)).catch(e => staff ? adm() : toast("Заказ не найден"));
  if (oid) api("/orders/" + oid).then(() => go("/order/" + oid)).catch(() => staff ? adm() : byNum()); else byNum();
}
// ---- автовыдача: данные товара от продавца, с кнопкой копирования
function autoBub(m) {
  const lines = String(m.body || "").split("\n"), head = lines.shift() || "", items = lines.filter(Boolean);
  return `<div class="fsys fauto" id="m${m.id}"><div class="otn"><b>Автовыдача</b><span class="tag">мгновенно</span><time>${new Date(m.created_at).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time></div><div class="otb"><i><svg viewBox="0 0 24 24" width="14" height="14"><path d="M13 2 4 14h6l-1 8 9-12h-6z" fill="currentColor"/></svg></i><div class="aitm"><p>${ordLink(esc(head), m.order_id)}</p>${items.map(x => `<div class="ait"><code>${esc(x)}</code><button class="btn sm" onclick="copyText(this.previousElementSibling.textContent)">Копировать</button></div>`).join("")}</div></div></div>`;
}
// ---- чат: лента сообщений в стиле маркетплейса
window.CHO = "";
function bubx(m) {
  if (m.kind === "system") return `<div class="fsys" id="m${m.id}"><div class="otn"><b>Система</b><span class="tag">оповещение</span><time>${new Date(m.created_at).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time></div><div class="otb"><i>i</i><p>${ordLink(esc(m.body), m.order_id)}${m.order_id ? ` <a class="lk" onclick="goOrd('${m.order_id}','${(/#([0-9A-Fa-f]{6,12})/.exec(m.body) || [])[1] || ""}')">Открыть заказ</a>` : ""}</p></div></div>`;
  if (m.kind === "auto") return autoBub(m);
  const mine = m.sender_id === ME.id, c = window.CHA || {}, name = mine ? ME.username : (m.sender_name || c.n || window.CHO || "Собеседник"), stf = m.kind === "staff" ? `<span class="tag">модератор</span>` : "", txt = m.body === "[вложение]" ? "" : esc(m.body), need = !mine && window.TR && TR.lang() && txt;
  const lot = m.lot_title && m.listing_id ? `<a class="lotc" onclick="go('/l/${m.listing_id}')">По лоту: ${esc(m.lot_title)}</a>` : "";
  const t = new Date(m.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }), rd = !!m.read_at;
  const ck = mine ? `<svg class="ck ${rd ? "rd" : ""}" width="17" height="12" viewBox="0 0 20 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 7.5l4 4L12 3"/>${rd ? '<path d="M8 10.5l1.5 1L17 3"/>' : ""}</svg>` : "";
  return `<div class="bb ${mine ? "me" : "th"}" id="m${m.id}"><div class="bbi" ${need ? `data-tr="${m.id}"` : ""}>${stf ? `<div class="bsf">Модератор</div>` : ""}${lot}${txt ? `<div class="bt">${txt}</div>` : ""}${m.atts && m.atts.length ? `<div class="mat">${atts(m.atts)}</div>` : ""}<div class="bm"><time>${t}</time>${ck}</div></div></div>`;
}
async function msgs(cid) {
  need(); const cs = await api("/conversations"); let ms = [], cur = null, on = null; CC = cid || null;
  if (cid) { cur = cs.find(c => c.id === cid); if (!cur) throw new Error("Диалог не найден"); window.CHO = cur.other; window.CHA = { n: cur.other, m: cur.avatar_media, p: cur.avatar_preset, on: cur.online }; on = !!cur.online; ms = await api(`/conversations/${cid}/messages`); UNREAD = cs.reduce((a, c) => a + (c.id === cid ? 0 : c.unread), 0); }
  else UNREAD = cs.reduce((a, c) => a + c.unread, 0);
  const tm = c => c.last_at ? new Date(c.last_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }) : "";
  const list = cs.map(c => `<a class="cr ${c.unread ? "un" : ""} ${c.id === cid ? "cur" : ""}" onclick="go('/chat/${c.id}')">${avs(c.other, c.avatar_media, c.online, c.avatar_preset)}<span class="cb"><span class="row bet" style="flex-wrap:nowrap"><b>${esc(c.other)}</b><small class="m">${tm(c)}</small></span><span class="m">${esc(c.last || "Нет сообщений")}</span></span>${c.unread ? `<b class="bd" style="position:static">${c.unread}</b>` : ""}</a>`).join("") || empty("Диалогов пока нет. Откройте объявление или профиль пользователя и напишите ему.");
  const head = cur ? `<div class="chh2"><a class="bk" onclick="go('/m')" aria-label="Назад">‹</a><a class="chu" onclick="go('/u/${encodeURIComponent(cur.other)}')">${avs(cur.other, cur.avatar_media, cur.online, cur.avatar_preset)}<span class="cb"><b>${esc(cur.other)}</b><small data-seen="${esc(cur.other)}" class="${on ? "on-s" : "m"}">${on ? "Онлайн" : seenLabel(cur.other)}</small></span></a><button class="ib2" onclick="go('/u/${encodeURIComponent(cur.other)}')" aria-label="Профиль">${svg(P.me)}</button><button class="ib2" onclick="go('/tickets?new=1')" aria-label="Поддержка и жалоба">${svg(IC.warn)}</button></div>` : "";
  const body = cur ? `${head}<div class="chm" id="chm">${bubs(ms)}</div><div id="achip"></div><div class="cmp cmp2 cmp3"><input id="lt" maxlength="2000" placeholder="Написать..." enterkeyhint="send" onkeydown="if(event.key==='Enter')sendC()"><button class="ib2" onclick="pickAtt('chat')" aria-label="Вложение">${svg(P.clip)}</button><button class="ib2 pri" onclick="sendC()" aria-label="Отправить">${svg(IC.arr)}</button></div>` : '<p class="m" style="margin:auto">Выберите диалог</p>';
  return `<div class="mm ${cid ? "ch" : ""}"><section class="ml"><h2>Сообщения</h2>${list}</section><section class="mc ${cur ? "mc2" : ""}">${body}</section></div>`;
}

// ---- вкладка «О пользователе»: ачивки и кодекс
function aboutExtra(u, cs) {
  const ach = u.progress ? `<div class="card tpl"><b class="tph">Ачивки</b>${achBlock(u)}</div>` : "";
  let code = "";
  if (cs && cs.state === "ok") code = `<div class="card tpl"><b class="tph">${ic4("shield", 16)} Кодекс продавца</b><p class="m" style="margin:6px 0 0">Продавец подписал кодекс ${fmtD(cs.signed_at)} и обязуется:</p>${rulesHtml(RULES4)}</div>`;
  else if (cs && cs.state) code = `<div class="card tpl"><b class="tph">${ic4("shield", 16)} Кодекс продавца</b><p style="margin:6px 0 0">${cs.state === "scam" ? "Помечен как скам." : "Нарушил кодекс, он сгорел."} ${esc(cs.reason || "")}</p></div>`;
  else if (u.is_seller) code = `<div class="card tpl"><b class="tph">${ic4("shield", 16)} Кодекс продавца</b><p class="m" style="margin:6px 0 0">Продавец пока не подписал кодекс.</p></div>`;
  return ach + code;
}

// ---- плашка роли в лотах/списках: владелец не показывается, админ и модератор показываются
function rtgS(r, c1, c2) { return r === "owner" ? "" : rtg(r, c1, c2) }

// ---- кастом карточки лота
const CST = [["flat", "Обычная"], ["glow", "Свечение"], ["gradient", "Градиент"], ["outline", "Рамка"], ["dashed", "Пунктир"], ["neon", "Неон"], ["stripe", "Полосы"], ["dots", "Точки"], ["shine", "Блик"], ["double", "Двойная"], ["glass", "Стекло"], ["top", "Верхняя линия"]];
const CBG = ["Хит", "Новинка", "Выгодно", "Топ", "Быстро", "Гарант", "Редкость", "Акция"];
function cardCls(l) { return "" }
function cardSt(l) { return "" }
function cardBadge(l) { return "" }
let CARDV = { style: "flat", accent: "#8B5CF6" }, CARDID = "";
async function cardForm(id) {
  need(); const l = await api("/listings/" + id); CARDID = id; const c = l.card || {}; CARDV = { style: c.style || "flat", accent: c.accent || "#8B5CF6", accent2: c.accent2 || "", badge: c.badge || "", shape: c.shape || "", title: !!c.title };
  mdl(`<h3 style="margin:0 0 8px">Оформление карточки</h3><p class="m" style="margin:0 0 10px">Видно в списках и поиске.</p><label>Стиль</label><div class="chips">${CST.map(x => `<button class="btn sm ${CARDV.style === x[0] ? "pri" : ""}" data-cs="${x[0]}" onclick="cardPick('${x[0]}')">${x[1]}</button>`).join("")}</div><div class="row" style="gap:14px"><div><label>Цвет</label><input type="color" value="${CARDV.accent}" oninput="CARDV.accent=this.value;cardPrev()"></div><div><label>Второй цвет</label><input type="color" value="${CARDV.accent2 || CARDV.accent}" oninput="CARDV.accent2=this.value;cardPrev()"></div></div><label>Метка</label><div class="chips"><button class="btn sm ${CARDV.badge ? "" : "pri"}" data-cb="" onclick="cardOpt('badge','')">Нет</button>${CBG.map(x => `<button class="btn sm ${CARDV.badge === x ? "pri" : ""}" data-cb="${x}" onclick="cardOpt('badge','${x}')">${x}</button>`).join("")}</div><label>Форма углов</label><div class="chips">${[["", "Стандарт"], ["sharp", "Острые"], ["round", "Круглые"], ["pill", "Сильно круглые"]].map(x => `<button class="btn sm ${CARDV.shape === x[0] ? "pri" : ""}" data-csh="${x[0]}" onclick="cardOpt('shape','${x[0]}')">${x[1]}</button>`).join("")}</div><label class="chk"><input type="checkbox" ${CARDV.title ? "checked" : ""} onchange="CARDV.title=this.checked;cardPrev()"> <span>Заголовок цветом акцента</span></label><div id="cprev" style="margin:12px 0"></div><button class="btn pri" style="width:100%" onclick="cardSave()">Сохранить</button><button class="btn" style="width:100%;margin-top:8px" onclick="cardSave(true)">Сбросить оформление</button>`);
  cardPrev();
}
function cardOpt(k, v) { CARDV[k] = v; const m = { badge: "data-cb", shape: "data-csh" }[k]; document.querySelectorAll("[" + m + "]").forEach(b => b.classList.toggle("pri", b.getAttribute(m) === v)); cardPrev() }
function cardPick(s) { CARDV.style = s; document.querySelectorAll("[data-cs]").forEach(b => b.classList.toggle("pri", b.dataset.cs === s)); cardPrev() }
function cardPrev() { const e = $("#cprev"); if (e) e.innerHTML = `<div class="rw rw2 cs-${CARDV.style} ${CARDV.shape ? "sh-" + CARDV.shape : ""} ${CARDV.title ? "ct" : ""}" style="--ca:${CARDV.accent};--cb:${CARDV.accent2 || CARDV.accent};cursor:default"><div class="rb">${CARDV.badge ? `<span class="cbd">${esc(CARDV.badge)}</span>` : ""}<div class="t">Так будет выглядеть карточка</div></div></div>` }
const cardSave = act(async reset => { await api(`/listings/${CARDID}/card`, { method: "PUT", body: reset === true ? {} : CARDV }); $("#md")?.remove(); toast("Сохранено"); route() });

// ---- подвал и документы
let SITE_CFG = {};
fetch("/api/site-config").then(r => r.json()).then(c => { SITE_CFG = c; const f = document.querySelector("#ft"); if (f) f.innerHTML = ftHtml() }).catch(() => { });
function ftHtml() {
  const c = SITE_CFG, ext = (u, t) => `<a href="${esc(u)}" target="_blank" rel="noopener">${t}</a>`, ins = (k, t) => `<a onclick="go('/legal/${k}')">${t}</a>`;
  const links = [c.privacy_url ? ext(c.privacy_url, "Политика конфиденциальности") : ins("privacy", "Политика конфиденциальности"), c.terms_url ? ext(c.terms_url, "Пользовательское соглашение") : ins("terms", "Пользовательское соглашение"), ins("rules", "Правила маркетплейса"), ins("buyer-rules", "Правила покупателей"), ins("seller-rules", "Правила продавцов"), `<a onclick="go('/code')">Кодекс продавца</a>`, ins("contacts", "Контакты"), `<a onclick="go('/tickets')">Поддержка</a>`];
  const sup = [c.support_tg ? `Telegram: <a href="https://t.me/${esc(c.support_tg)}" target="_blank" rel="noopener">@${esc(c.support_tg)}</a>` : "", c.support_email ? `Email: <a href="mailto:${esc(c.support_email)}">${esc(c.support_email)}</a>` : ""].filter(Boolean).join(" · ");
  return `<div class="fl">${links.join("")}</div>${sup ? `<div class="m" style="margin-top:8px">Поддержка: ${sup}</div>` : ""}<div class="m" style="margin-top:8px">DonutPay. Оплата скоро появится.</div>`;
}
window.LEGX = {
  rules: () => ["Правила маркетплейса", `<p>DonutPay помогает покупателям и продавцам цифровых товаров и услуг находить друг друга. Пользуясь сайтом, вы соглашаетесь с этими правилами.</p><h3>1. Общее</h3><p>Регистрироваться могут совершеннолетние пользователи. Один человек ведёт один аккаунт. Данные в профиле и объявлениях должны быть правдивыми.</p><h3>2. Что запрещено</h3><p>Обман покупателей и продавцов; продажа товаров, которые вы не вправе продавать; публикация чужих личных данных, паролей и секретных ключей; оскорбления, угрозы и спам; создание нескольких аккаунтов для накрутки отзывов; попытки обойти правила площадки или вывести покупателя на сделку вне сайта.</p><h3>3. Сделки и споры</h3><p>Заказ создаётся на странице лота. Если продавец не выдал товар или выдал не тот, откройте спор в карточке заказа. Спор рассматривает модерация, в нём учитываются переписка и вложения.</p><h3>4. Оплата</h3><p>Приём платежей пока не подключён: заказы создаются со статусом «Ожидает оплаты», деньги не списываются. Условия оплаты и комиссий будут опубликованы до запуска.</p><h3>5. Меры</h3><p>За нарушения мы можем скрыть объявление, ограничить возможности аккаунта или заблокировать его. Продавцу, нарушившему Кодекс продавца, ставится пометка в профиле.</p><h3>6. Контакты</h3><p>Вопросы и жалобы: <a class="lk" onclick="go('/legal/contacts')">страница контактов</a>.</p>`],
  "seller-rules": () => ["Правила продавцов", `<h3>1. Допуск</h3><p>Чтобы публиковать объявления, нужно подписать Кодекс продавца и подтвердить контакт через Telegram-бота.</p><h3>2. Кодекс продавца</h3>${rulesHtml(RULES4)}<p>Нарушение кодекса сжигает его: в профиле появляется пометка, а покупатель видит предупреждение на странице лота.</p><h3>3. Объявления</h3><p>Описывайте товар честно и полно. Указывайте реальное наличие и срок выдачи. Объявления проходят модерацию. Нельзя публиковать пароли и секретные данные в тексте объявления.</p><h3>4. Выдача</h3><p>Выдавайте товар в срок и после выдачи сообщайте об этом покупателю в чате. Переписку по заказу ведите на площадке: она учитывается в спорах.</p><h3>5. Акции</h3><p>Час распродажи и совместные покупки включаются продавцом самостоятельно и действуют только на выбранные лоты.</p><h3>6. Комиссии и выплаты</h3><p>Оплата пока не подключена. Размер комиссии и порядок выплат будут опубликованы до запуска оплаты.</p>`],
  contacts: () => { const c = SITE_CFG || {}, rows = [c.support_tg ? `<p>Telegram: <a class="lk" href="https://t.me/${esc(c.support_tg)}" target="_blank" rel="noopener">@${esc(c.support_tg)}</a></p>` : "", c.support_email ? `<p>Email: <a class="lk" href="mailto:${esc(c.support_email)}">${esc(c.support_email)}</a></p>` : ""].join(""); return ["Контакты", `<p>Служба поддержки отвечает на вопросы по заказам, оплате, аккаунту и объявлениям.</p>${rows || '<p class="m">Прямые контакты пока не указаны, пользуйтесь обращениями.</p>'}<p><a class="lk" onclick="go('/tickets?new=1')">Написать обращение в поддержку</a> (нужен вход в аккаунт).</p><p>Забыли пароль? <a class="lk" onclick="go('/reset')">Сброс пароля</a>.</p>`] }
};

// ---- сброс пароля
function resetPage() {
  return `<div class="card" style="max-width:420px;margin:30px auto"><h2 style="margin-top:0">Сброс пароля</h2><p class="m">Введите email. Если аккаунт привязан к Telegram (подтверждение продавца), бот пришлёт одноразовый код на 15 минут. Если привязки нет, напишите в поддержку: администратор выдаст код.</p><label>Email</label><input id="rem" type="email" autocomplete="email"><button class="btn" style="width:100%;margin-top:10px" onclick="resetReq()">Получить код в Telegram</button><hr style="border:0;border-top:1px solid var(--b);margin:16px 0"><label>Код</label><input id="rco" autocomplete="one-time-code" autocapitalize="characters" maxlength="12"><label>Новый пароль (минимум 8 символов)</label><input id="rpw" type="password" autocomplete="new-password"><button class="btn pri" style="width:100%;margin-top:12px" onclick="resetDo()">Сменить пароль</button><p class="m"><a class="lk" onclick="go('/legal/contacts')">Контакты поддержки</a> · <a class="lk" onclick="go('/login')">Вход</a></p></div>`;
}
const resetReq = act(async () => { const e = $("#rem").value.trim(); if (!e) throw new Error("Введите email"); await api("/auth/reset/request", { method: "POST", body: { email: e } }); toast("Если аккаунт привязан к Telegram, код отправлен") });
const resetDo = act(async () => { await api("/auth/reset/confirm", { method: "POST", body: { email: $("#rem").value.trim(), code: $("#rco").value, password: $("#rpw").value } }); toast("Пароль изменён. Войдите с новым паролем"); go("/login") });
const pwCode = act(async name => { const r = await api(`/admin/users/${encodeURIComponent(name)}/reset-code`, { method: "POST" }); mdl(`<h3 style="margin:0 0 8px">Код сброса пароля</h3><p class="m" style="margin:0 0 8px">Передайте код пользователю ${esc(name)} лично. Действует ${r.expires_minutes} минут, одноразовый. Пользователь вводит его на странице «Сброс пароля» вместе со своим email.</p><div class="card" style="font-size:22px;letter-spacing:2px;text-align:center;user-select:all">${esc(r.code)}</div>`) });

// ---- алфавит игр
function azGo(l) { const e = document.getElementById("L-" + l); if (e) window.scrollTo({ top: e.getBoundingClientRect().top + scrollY - 120, behavior: "smooth" }) }

function azTop() { const h = document.querySelector("header"); if (h) document.documentElement.style.setProperty("--hhh", h.offsetHeight + "px"); AZL = ""; azSpy() }


// ---- финансы (тестовый баланс; реальные платежи не подключены)
const fm = n => Number(n).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₽";
function ago(d) { const s = (Date.now() - new Date(d).getTime()) / 1000, n = (k, a) => k + " " + (k % 10 === 1 && k % 100 !== 11 ? a[0] : k % 10 >= 2 && k % 10 <= 4 && (k % 100 < 10 || k % 100 >= 20) ? a[1] : a[2]) + " назад"; if (s < 60) return "только что"; if (s < 3600) return n(Math.floor(s / 60), ["минуту", "минуты", "минут"]); if (s < 86400) return n(Math.floor(s / 3600), ["час", "часа", "часов"]); if (s < 7 * 86400) return n(Math.floor(s / 86400), ["день", "дня", "дней"]); return "" }
const FOP = {
  test_topup: () => ["Пополнение тестового баланса", "Завершено", "ok"], topup: () => ["Пополнение баланса", "Завершено", "ok"],
  order_payment: o => ["Заказ #" + (o.order_number || ""), "Оплачено", "ok"], order_payout: o => ["Заказ #" + (o.order_number || "") + " · выплата продавцу", "Завершено", "ok"],
  refund: o => ["Возврат по заказу #" + (o.order_number || ""), "Завершено", "ok"],
  withdraw: o => ["Вывод средств", { pending: "В обработке", paid: "Выплачено", rejected: "Отклонено" }[o.w_status] || "В обработке", o.w_status === "paid" ? "ok" : o.w_status === "rejected" ? "bad" : "wait"],
  withdraw_refund: () => ["Возврат отклонённого вывода", "Завершено", "ok"], adjustment: () => ["Корректировка", "Завершено", "ok"]
};
async function financePage() {
  need(); const type = new URLSearchParams(location.hash.split("?")[1] || "").get("type") || "all", d = await api("/finance?type=" + type);
  const rows = d.ops.map(o => { const f = (FOP[o.kind] || (() => [o.kind, "", "ok"]))(o), a = ago(o.created_at); return `<div class="fop ${f[2] === "wait" ? "wait" : ""}" ${o.ref_type === "order" ? `onclick="go('/orders')"` : ""}><div class="fd">${fmtD(o.created_at)}${a ? `<small class="m"> ${a}</small>` : ""}</div><div class="ft2">${esc(f[0])}</div><div class="row bet"><b class="st-${f[2]}">${esc(f[1])}</b><b class="${o.amount < 0 ? "neg" : "pos"}">${o.amount < 0 ? "−" : "+"} ${fm(Math.abs(o.amount))}</b></div></div>` }).join("") || empty("Операций пока нет.");
  return `<h2>Финансы</h2><div class="fbal"><b>${fm(d.balance)}</b></div><div class="finfo"><b>i</b><p>${d.test_mode ? "Сейчас это тестовый баланс для проверки сайта: реальные деньги не принимаются и не выплачиваются. Платёжные способы подключаются." : "Пополнение пока недоступно: платёжный способ ещё не подключён."}</p></div><div class="fact"><select onchange="go('/finance?type='+this.value)"><option value="all" ${type === "all" ? "selected" : ""}>Все операции</option><option value="in" ${type === "in" ? "selected" : ""}>Пополнения и доходы</option><option value="out" ${type === "out" ? "selected" : ""}>Траты</option><option value="withdraw" ${type === "withdraw" ? "selected" : ""}>Выводы</option></select>${d.test_mode ? `<button class="btn" onclick="topupForm()">Пополнить</button>` : ""}<button class="btn pri" onclick="withdrawForm(${d.balance})">Вывести деньги</button></div><div class="fops"><div class="fh"><b>Описание</b><b>Сумма</b></div>${rows}</div>`;
}
function topupForm() {
  mdl(`<h3 style="margin:0 0 8px">Пополнить тестовый баланс</h3><p class="m" style="margin:0 0 10px">Это не реальные деньги: баланс нужен, чтобы проверять покупки и выплаты.</p><label>Сумма, ₽</label><input id="tpa" type="number" inputmode="numeric" min="10" max="50000" value="1000"><div class="chips" style="margin:8px 0">${[100, 500, 1000, 5000].map(v => `<a onclick="$('#tpa').value=${v}">${v}</a>`).join("")}</div><button class="btn pri" style="width:100%" onclick="topupDo()">Пополнить</button>`);
}
const topupDo = act(async () => { await api("/finance/topup", { method: "POST", body: { amount: +$("#tpa").value } }); $("#md")?.remove(); toast("Баланс пополнен"); route() });
function withdrawForm(bal) {
  mdl(`<h3 style="margin:0 0 8px">Вывести деньги</h3><p class="m" style="margin:0 0 10px">Доступно: ${fm(bal)}. Заявки обрабатывает администратор вручную. Пока баланс тестовый, реальные деньги не переводятся.</p><label>Сумма, ₽</label><input id="wda" type="number" inputmode="numeric" min="10" value="${Math.floor(bal) >= 10 ? Math.floor(bal) : 10}"><label>Способ</label><select id="wdm"><option value="card">Банковская карта</option><option value="sbp">СБП</option><option value="crypto">Криптовалюта</option><option value="other">Другое</option></select><label>Реквизиты</label><input id="wdd" maxlength="200" placeholder="Номер карты, телефон или адрес кошелька"><button class="btn pri" style="width:100%;margin-top:12px" onclick="withdrawDo()">Отправить заявку</button>`);
}
const withdrawDo = act(async () => { await api("/finance/withdraw", { method: "POST", body: { amount: +$("#wda").value, method: window._wdm || ($("#wdm") && $("#wdm").value) || "card", details: $("#wdd").value } }); $("#md")?.remove(); toast("Заявка отправлена"); route() });
const payBal = id => payConfirm(id);
async function wdAdmin() {
  const ws = await api("/admin/withdrawals");
  return ws.map(w => `<div class="card"><div class="row bet"><b>${esc(w.username)} · ${fm(w.amount)}</b><span class="tag">${{ pending: "Ожидает", paid: "Выплачено", rejected: "Отклонено" }[w.status]}</span></div><div class="m">${{ card: "Карта", sbp: "СБП", crypto: "Крипта", other: "Другое" }[w.method]}: ${esc(w.details)}</div><small class="m">${fmtD(w.created_at)}</small>${w.status === "pending" ? `<div class="row" style="margin-top:8px"><button class="btn sm pri" onclick="wdAct('${w.id}','paid')">Выплачено</button><button class="btn sm dng" onclick="wdAct('${w.id}','reject')">Отклонить и вернуть</button></div>` : ""}</div>`).join("") || empty("Заявок на вывод нет.");
}
const wdAct = act(async (id, action) => { await api("/admin/withdrawals/" + id, { method: "POST", body: { action } }); route() });


// ---- перетаскивание элементов профиля в редакторе
Object.defineProperty(window, "PEDIT", { get: () => !!document.querySelector("#pvw"), configurable: true });
(function () {
  let d = null;
  document.addEventListener("pointerdown", e => { const el = e.target.closest && e.target.closest("#pvw [data-drag]"); if (!el || typeof PV === "undefined") return; e.preventDefault(); const k = el.dataset.drag; PV.pos = PV.pos || {}; const p = PV.pos[k] || { x: 0, y: 0 }; d = { el, k, sx: e.clientX, sy: e.clientY, ox: p.x || 0, oy: p.y || 0 }; try { el.setPointerCapture(e.pointerId) } catch { } });
  document.addEventListener("pointermove", e => { if (!d) return; const x = Math.max(-160, Math.min(160, Math.round(d.ox + e.clientX - d.sx))), y = Math.max(-120, Math.min(120, Math.round(d.oy + e.clientY - d.sy))); PV.pos[d.k] = { x, y }; d.el.style.translate = x + "px " + y + "px" });
  const end = () => { d = null }; document.addEventListener("pointerup", end); document.addEventListener("pointercancel", end);
})();
function posReset() { if (typeof PV !== "undefined") { PV.pos = {}; pvr() } }

// ---- чат: высота по видимой области (клавиатура не сдвигает страницу), шапка и нижнее меню остаются
(function () {
  const vv = window.visualViewport, root = document.documentElement;
  function set() {
    const kb = !!vv && innerHeight - vv.height > 120, inchat = !!document.querySelector(".mm.ch");
    document.body.classList.toggle("inchat", inchat); document.body.classList.toggle("kb", kb);
    const hd = document.querySelector("header"), bn = document.querySelector(".bn");
    root.style.setProperty("--vvh", (vv ? vv.height : innerHeight) + "px"); root.style.setProperty("--vvt", (vv ? vv.offsetTop : 0) + "px");
    root.style.setProperty("--hhh", (hd ? hd.offsetHeight : 0) + "px");
    root.style.setProperty("--bnh", (bn && getComputedStyle(bn).display !== "none" ? bn.offsetHeight : 0) + "px");
    if (inchat) { window.scrollTo(0, 0); const m = document.querySelector("#chm"); if (m && kb) m.scrollTop = 1e9 }
  }
  if (vv) { vv.addEventListener("resize", set); vv.addEventListener("scroll", () => { if (document.body.classList.contains("inchat")) { window.scrollTo(0, 0); set() } }) }
  addEventListener("resize", set); addEventListener("hashchange", () => setTimeout(set, 60));
  const ar = window.afterRoute; window.afterRoute = function () { const r = ar && ar.apply(this, arguments); setTimeout(set, 0); return r };
  document.addEventListener("focusin", e => { if (e.target && e.target.id === "lt") [60, 250, 500, 900].forEach(d => setTimeout(set, d)) }); document.addEventListener("focusout", e => { if (e.target && e.target.id === "lt") [60, 300, 700].forEach(d => setTimeout(set, d)) });
  set();
})();


// ---- форма в модальном окне вместо prompt()/confirm() (на iPhone они блокируются)
function formM(title, fields, ok, fn) {
  window._fm = fn; window._fmf = fields;
  const ctl = f => f.t === "area" ? `<textarea id="fm_${f.k}" rows="3" maxlength="${f.max || 1000}">${esc(f.v || "")}</textarea>` : f.t === "select" ? `<select id="fm_${f.k}">${f.o.map(o => `<option value="${o[0]}" ${String(o[0]) === String(f.v) ? "selected" : ""}>${esc(o[1])}</option>`).join("")}</select>` : `<input id="fm_${f.k}" type="${f.t || "text"}" ${f.t === "number" ? 'inputmode="numeric"' : ""} maxlength="${f.max || 200}" value="${esc(f.v ?? "")}">`;
  mdl(`<h3 style="margin:0 0 10px">${esc(title)}</h3>${fields.map(f => `<label>${esc(f.l)}</label>${ctl(f)}`).join("")}<button class="btn pri" style="width:100%;margin-top:12px" onclick="fmGo()">${esc(ok)}</button>`);
}
const fmGo = act(async () => { const v = {}; (window._fmf || []).forEach(f => v[f.k] = $("#fm_" + f.k).value); const fn = window._fm; $("#md")?.remove(); await fn(v) });

// ---- подтверждение оплаты заказа с баланса
const ckSteps = n => `<div class="cks">${["Оплата", "Выдача товара", "Получение"].map((t, i) => `<div class="${i < n ? "dn" : i === n ? "cur" : ""}"><i>${i < n ? "✓" : i + 1}</i><span>${t}</span></div>`).join("")}</div>`;
const payConfirm = act(async id => {
  need(); const [o, f] = await Promise.all([api("/orders/" + id), api("/finance")]), sum = o.total_cents / 100, left = f.balance - sum, enough = left >= 0;
  if (o.status !== "pending_payment") throw new Error("Заказ уже не ждёт оплаты");
  window._pay = { id, need: Math.ceil(-left), test: f.test_mode };
  const unit = o.unit_price_cents / 100;
  const pr = o.promo, pct = pr && pr.kind === "percent" ? +pr.value : 0, gross = (+o.unit_price_cents * o.quantity) / 100;
  const pBtn = enough ? `<button class="btn pri big" style="width:100%" onclick="payDo()">Оплатить ${fm(sum)}</button>` : f.test_mode ? `<div class="ckw">Не хватает ${fm(-left)}</div><button class="btn pri big" style="width:100%" onclick="payTop()">Пополнить на ${fm(Math.max(10, window._pay.need))} и оплатить</button>` : `<button class="btn big" style="width:100%" onclick="$('#md').remove();go('/finance')">Перейти в финансы</button>`;
  mdl(`<div class="ckh"><div><h3>Оформление заказа</h3><small class="m">Заказ #${esc(o.number || "")}</small></div></div>${ckSteps(0)}
<div class="ckp">${o.image_media ? `<img src="/api/media/${o.image_media}" alt="">` : `<span class="ckpi">${ic4("box", 22)}</span>`}<div class="ckpb"><small>${esc(o.game_name || "")}${o.category_name ? " · " + esc(o.category_name) : ""}</small><b>${esc(o.title)}</b><small>Продавец: ${esc(o.seller_name || "")}${o.quantity > 1 ? " · " + o.quantity + " шт." : ""}</small>${o.auto_delivery ? `<span class="abd"><svg viewBox="0 0 24 24" width="12" height="12"><path d="M13 2 4 14h6l-1 8 9-12h-6z" fill="currentColor"/></svg>Автовыдача: товар придёт в чат сразу</span>` : ""}</div></div>
${pr ? `<div class="ckpr"><span><b>${esc(pr.code)}</b>${pct ? ` · скидка ${pct}%` : ""}</span><a onclick="promoApply('${id}',true)">Убрать</a></div>` : `<div class="pmr"><input id="pmc" placeholder="Промокод" maxlength="32" autocapitalize="characters" value="" style="text-transform:uppercase"><button class="btn" onclick="promoApply('${id}')">Применить</button></div>`}
<div class="cksum"><div><span>Цена${o.quantity > 1 ? " × " + o.quantity : ""}</span><b>${fm(gross)}</b></div>${o.discount_cents > 0 ? `<div><span>Скидка${pct ? " " + pct + "%" : ""}</span><b class="okt">−${fm(o.discount_cents / 100)}</b></div>` : ""}<div><span>Способ оплаты</span><b>Баланс DonutPay</b></div><div><span>Ваш баланс</span><b>${fm(f.balance)}</b></div><div class="tot"><span>К оплате</span><b>${fm(sum)}</b></div></div>
<div class="ckg">${ic4("shield", 18)}<p>Деньги у продавца только после того, как вы подтвердите получение товара. При споре их вернёт модератор.${f.test_mode ? " Баланс тестовый: реальные деньги не списываются, оплата картой и СБП появится позже." : ""}</p></div>${pBtn}`);
});
const payDo = act(async () => {
  if (window._paying) return; window._paying = 1; const id = window._pay.id;
  try { const r = await api(`/orders/${id}/pay-balance`, { method: "POST" }); $("#md")?.remove(); mdl(`<div style="text-align:center"><div class="okc">✓</div><h3 style="margin:8px 0 2px">Оплата прошла</h3><p class="m" style="margin:0 0 10px">Заказ #${esc(r.number || "")} оплачен ${new Date().toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</p></div>${ckSteps(1)}<button class="btn pri big" style="width:100%;margin-top:14px" onclick="$('#md').remove();go('/order/${id}')">Перейти к заказу</button>`); SFX.play && SFX.play("ok") }
  finally { window._paying = 0 }
});
const payTop = act(async () => { if (window._paying) return; window._paying = 1; try { await api("/finance/topup", { method: "POST", body: { amount: Math.max(10, window._pay.need) } }) } finally { window._paying = 0 } await payConfirm(window._pay.id) });

// ---- алфавит игр следит за прокруткой
let AZL = "";
function azSpy() {
  const bar = document.querySelector(".ai"), hs = document.querySelectorAll(".lh"); if (!bar || !hs.length) { AZL = ""; return }
  const y = (parseInt(getComputedStyle(document.documentElement).getPropertyValue("--hhh")) || 110) + 40; let cur = hs[0];
  for (const h of hs) { if (h.getBoundingClientRect().top <= y) cur = h; else break }
  const id = cur.id.slice(2); if (id === AZL) return; AZL = id;
  bar.querySelectorAll("a").forEach(a => { const on = a.textContent === id; a.classList.toggle("on", on); if (on) bar.scrollTo({ top: a.offsetTop - bar.clientHeight / 2 + a.offsetHeight / 2, behavior: "smooth" }) });
}
addEventListener("scroll", azSpy, { passive: true });
(function () { const hd = document.querySelector("header"); if (hd && window.ResizeObserver) new ResizeObserver(() => { document.documentElement.style.setProperty("--hhh", hd.offsetHeight + "px") }).observe(hd) })();

// ---- редактирование новости
const newsEdit = act(async id => {
  const n = (await api("/news?limit=30")).find(x => x.id === id); if (!n) throw new Error("Новость не найдена");
  window._ne = id;
  mdl(`<h3 style="margin-top:0">Изменить новость</h3><label>Заголовок</label><input id="nt" maxlength="120" value="${esc(n.title)}"><label>Текст</label><textarea id="nb" rows="6" maxlength="4000">${esc(n.body || "")}</textarea>${(n.media_ids || []).length ? `<label>Фото (снимите галочку, чтобы удалить)</label><div class="nek">${n.media_ids.map(m => `<label class="nei"><input type="checkbox" class="nkp" value="${m}" checked><img src="/api/media/${m}" alt=""></label>`).join("")}</div>` : ""}<label>Добавить фото</label><input id="nf" type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif"><button class="btn pri" style="margin-top:10px;width:100%" onclick="newsEditSave(this)">Сохранить</button>`);
});
const newsEditSave = act(async btn => {
  const t = $("#nt").value.trim(); if (t.length < 3) throw new Error("Заголовок: минимум 3 символа");
  btn.disabled = true; btn.textContent = "Сохраняю…";
  try { const ids = []; for (const f of [...$("#nf").files].slice(0, 6)) ids.push(await upload(f, "news")); await api("/admin/news/" + window._ne, { method: "PATCH", body: { title: t, body: $("#nb").value, keep: [...document.querySelectorAll(".nkp:checked")].map(x => x.value), media: ids } }); $("#md")?.remove(); toast("Новость обновлена"); route() }
  catch (e) { btn.disabled = false; btn.textContent = "Сохранить"; throw e }
});

const promoApply = act(async (id, clear) => { const code = clear ? "" : $("#pmc").value.trim(); if (!clear && !code) return; await api(`/orders/${id}/promo`, { method: "POST", body: { code } }); $("#md")?.remove(); await payConfirm(id); toast(clear ? "Промокод убран" : "Промокод применён") });
