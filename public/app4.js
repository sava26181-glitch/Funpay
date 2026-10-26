// v4: новости, час распродажи, кодекс продавца, битвы магазинов, совместная покупка, личный чат
Object.assign(ERR, {
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
  swords: "M4 3l7 7-2 2-7-7zM20 3l-7 7 2 2 7-7zM9 14l-5 5 1 1 5-5zM15 14l5 5-1 1-5-5z",
  users: "M9 11a4 4 0 100-8 4 4 0 000 8zm8 0a3 3 0 100-6 3 3 0 000 6zM2 21a7 7 0 0114 0zm15-6a6 6 0 015 6h-5z",
  news: "M4 4h13v16H6a2 2 0 01-2-2zm13 3h3v11a2 2 0 01-2 2h-1zM7 8h7v2H7zm0 4h7v2H7z",
  trophy: "M7 3h10v5a5 5 0 01-10 0zM4.500 4H2v2.500A3.500 3.500 0 005.500 10M19.500 4H22v2.500a3.500 3.500 0 01-3.500 3.500M11 14h2v4h3.500v3h-9v-3H11z"
};
const ic4 = (k, s = 16) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="currentColor" aria-hidden="true" style="flex:none"><path d="${IC4[k]}"/></svg>`;
const fmtD = d => new Date(d).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });

// ---- таймеры
const cdFmt = ms => { const s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return (h ? h + ":" : "") + String(m).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0") };
function tick() { document.querySelectorAll("[data-end]").forEach(e => { const d = new Date(e.dataset.end) - Date.now(); if (d <= 0) { if (!e.dataset.done) { e.dataset.done = 1; e.textContent = "завершено"; e.closest(".fl,.flb,.fcard")?.classList.add("end") } } else { e.textContent = cdFmt(d); delete e.dataset.done; e.closest(".fl,.flb,.fcard")?.classList.remove("end") } }) }
setInterval(tick, 1000);

// ---- цены и метки
function pr(l) { return l.sale_cents && l.sale_ends ? `<span class="prs"><s class="old">${rub(l.price_cents)}</s><b class="price">${rub(l.sale_cents)}</b></span>` : `<b class="price">${rub(l.price_cents)}</b>` }
function saleTag(l) { return l.sale_cents && l.sale_ends ? `<span class="fl">${ic4("bolt", 12)}−${l.sale_percent}% · <i data-end="${l.sale_ends}">--:--</i></span>` : "" }
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
  return `${head}<div class="fscr">${fl.map(l => `<div class="fcard" onclick="go('/l/${l.id}')"><span class="fl">${ic4("bolt", 12)}−${l.sale_percent}% · <i data-end="${l.sale_ends}">--:--</i></span><div class="m">${esc(l.game_name)}</div><b class="t">${esc(l.title)}</b><div class="fp"><s class="old">${rub(l.price_cents)}</s><b class="price">${rub(l.sale_cents)}</b></div><small class="m">${esc(l.seller)}${cmk(l.code_state)}</small></div>`).join("")}</div>`;
}
function newsList(ns) {
  if (!ns.length) return empty("Новостей пока нет.");
  return ns.map(n => `<article class="news"><div class="row bet"><b class="nt">${esc(n.title)}</b>${isAdm() ? `<button class="btn sm dng" onclick="newsDel('${n.id}')" aria-label="Удалить новость">Удалить</button>` : ""}</div><small class="m">${fmtD(n.created_at)}${n.author ? " · " + esc(n.author) : ""}</small>${(n.media_ids || []).length ? `<div class="nph n${Math.min(n.media_ids.length, 3)}">${n.media_ids.map(id => `<img loading="lazy" src="/api/media/${id}" alt="" onclick="lbx(this.src)">`).join("")}</div>` : ""}${n.body ? `<p class="nb">${esc(n.body)}</p>` : ""}</article>`).join("");
}
async function home() {
  const [ls, news, fl] = await Promise.all([api("/listings?sort=new"), api("/news?limit=10").catch(() => []), api("/flash").catch(() => [])]);
  setTimeout(tick, 0);
  return `<section class="promo"><div class="pl">${logo(76)}<h1>Всё для твоих любимых игр</h1></div><p>Находи игровые товары и услуги в одном месте.</p><button class="btn pri big" onclick="go('/games')">Перейти к покупкам</button></section>
<div class="qk"><a onclick="go('/battles')">${ic4("swords", 20)}<b>Битвы магазинов</b><small>Каждую неделю</small></a><a onclick="go('/code')">${ic4("shield", 20)}<b>Кодекс продавца</b><small>Честные правила</small></a></div>
${flashBlock(fl)}
<div class="row bet" style="margin-top:var(--gap)"><h2 class="h2i">${ic4("news", 20)}Новости</h2>${isAdm() ? '<button class="btn sm pri" onclick="newsForm()">Добавить новость</button>' : ""}</div><div class="nws">${newsList(news)}</div>
<h2>Новые предложения</h2>${rows(ls.slice(0, 5), "Пока нет опубликованных предложений.")}`;
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
const newsDel = act(async id => { if (!confirm("Удалить новость?")) return; await api("/admin/news/" + id, { method: "DELETE" }); toast("Удалено"); route() });

// ---- час распродажи (продавец)
let MYFL = [];
const myFl = id => { const f = MYFL.find(x => x.listing_id === id); return f ? ` · <span class="fl">${ic4("bolt", 12)}−${f.percent}% · <i data-end="${f.ends_at}">--:--</i></span>` : "" };
const flBtn = l => { if (l.status !== "active") return ""; const on = MYFL.some(x => x.listing_id === l.id); return on ? `<button class="btn sm" onclick="flStop('${l.id}')">Остановить распродажу</button>` : `<button class="btn sm" onclick="flashForm('${l.id}')">Час распродажи</button>` };
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
const codeSign = act(async () => { if (!$("#cag")?.checked) throw new Error("Подтвердите согласие с кодексом"); await api("/seller-code/sign", { method: "POST", body: { agree: true } }); ME = await api("/me"); toast("Кодекс подписан"); go("/sell") });
function codeGate(c) { const m = c.mine; if (m && m.state !== "ok") return `<h2>Продажа</h2><div class="card cbad"><b>${m.state === "scam" ? "Аккаунт помечен как скам" : "Ваш кодекс сгорел"}</b><div class="m">Публиковать объявления нельзя.</div></div>`; return `<h2>Продажа</h2><div class="card"><p style="margin-top:0">Чтобы публиковать объявления, подпишите публичный Кодекс продавца.</p><button class="btn pri" onclick="go('/code')">Открыть кодекс</button></div>` }
const _sell = sell;
sell = async function () { need(); const c = await api("/seller-code"); if (!c.mine || c.mine.state !== "ok") return codeGate(c); return _sell() };

function codeCard(cs, u) {
  if (!cs || !cs.state) return u.is_seller ? `<div class="card cnone"><small class="m">Кодекс продавца не подписан</small></div>` : "";
  if (cs.state === "ok") return `<details class="card cok"><summary>${ic4("shield", 18)}<b>Подписал Кодекс продавца</b><small class="m">с ${fmtD(cs.signed_at)}</small></summary>${rulesHtml(RULES4)}</details>`;
  return `<div class="card cbad"><b>${cs.state === "scam" ? "Помечен как скам" : "Нарушил Кодекс продавца"}</b><div class="m">${esc(cs.reason || "")}</div><small class="m">${cs.revoked_at ? fmtD(cs.revoked_at) + ". " : ""}${cs.state === "scam" ? "Аккаунт заблокирован." : "Кодекс сгорел, доверяйте с осторожностью."}</small></div>`;
}
function staffCode(u, cs) {
  const st = cs && cs.state, adm = isAdm();
  return `${st === "ok" || !st ? `<button class="btn sm dng" onclick="codeAct('${u.id}','burn')">Сжечь кодекс</button>` : ""}${adm && st !== "scam" ? `<button class="btn sm dng" onclick="codeAct('${u.id}','scam')">Скам</button>` : ""}${adm && (st === "violation" || st === "scam") ? `<button class="btn sm" onclick="codeAct('${u.id}','restore')">Снять пометку</button>` : ""}`;
}
function codeAct(id, kind) {
  if (kind === "restore") { if (!confirm("Снять пометку и вернуть кодекс?")) return; return codeGo(id, kind, ""); }
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
  return `<h2 class="h2i">${ic4("swords", 20)}Битвы магазинов</h2><p class="m" style="margin-top:0">Раз в неделю два магазина одной категории соревнуются: у кого больше завершённых заказов, тот побеждает и получает значок «Победитель недели» на 7 дней. Считаются только заказы со статусом «Завершён».</p><h3>Идут сейчас</h3>${live || empty("Пока нет активных битв. Битва начинается, когда в категории записались минимум два продавца.")}<h3>Победители</h3>${done || empty("Завершённых битв с победителем пока нет.")}<h3>Участие</h3><div class="card">${part}</div>`;
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
function copyText(t) { (navigator.clipboard?.writeText(t) || Promise.reject()).then(() => toast("Ссылка скопирована")).catch(() => toast("Скопируйте адрес из строки браузера")) }
const groupJoin = act(async id => { if (!confirm("Принять условия и присоединиться? Будет создан заказ, деньги не списываются: оплата не подключена.")) return; await api(`/groups/${id}/join`, { method: "POST" }); toast("Вы присоединились"); go("/orders") });
const groupCancel = act(async id => { await api(`/groups/${id}/cancel`, { method: "POST" }); toast("Отменено"); route() });
