// v24: сброс пароля по коду с почты, смена пароля и двухэтапная аутентификация в настройках
Object.assign(ERR, {
  "captcha": "Подтвердите, что вы не робот, и повторите",
  "too many requests": "Слишком много запросов. Подождите минуту и повторите",
  "temporarily blocked": "Слишком много запросов с вашего адреса. Попробуйте через несколько минут",
  "too many registrations": "Слишком много регистраций с этого адреса. Попробуйте позже",
  "too many messages": "Вы отправляете сообщения слишком часто. Подождите немного",
  "too many tickets": "Слишком много обращений. Попробуйте позже",
  "too many reports": "Слишком много жалоб. Попробуйте позже",
  "too many listings": "Достигнут дневной лимит объявлений",
  "too many orders": "Слишком много заказов за короткое время. Попробуйте позже",
  "disposable email": "Временные почтовые адреса не поддерживаются",
  "wrong 2fa code": "Неверный код. Проверьте код в приложении или введите резервный код",
  "wrong password": "Неверный пароль",
  "too many attempts": "Слишком много попыток. Подождите 15 минут",
  "2fa already enabled": "Двухэтапная аутентификация уже включена"
});

// ---- сброс пароля
const IC9 = {
  user: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg>',
  key: '<svg viewBox="0 0 24 24"><circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3M14 9l2 2"/></svg>',
  eye: '<svg viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>'
};
window.eyeTog = id => { const i = document.getElementById(id); if (!i) return; const sh = i.type === "password"; i.type = sh ? "text" : "password"; i.parentNode.querySelector(".eye").classList.toggle("on", sh) };
const HP9 = '<input id="hp" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;width:1px;height:1px;opacity:0;pointer-events:none">';
const CF9 = '<div id="cfw" style="display:flex;justify-content:center;margin-top:14px"></div>';
window.cfReset = () => { window._cf = ""; try { window.turnstile && window.turnstile.reset() } catch { } };
window.cfMount = () => {
  const k = (typeof SITE_CFG !== "undefined" && SITE_CFG && SITE_CFG.turnstile) || "", box = document.getElementById("cfw"); if (!k || !box || box.dataset.m) return; box.dataset.m = "1"; window._cf = "";
  const go = () => { try { window.turnstile.render(box, { sitekey: k, theme: "auto", callback: t => { window._cf = t }, "expired-callback": () => { window._cf = "" }, "error-callback": () => { window._cf = "" } }) } catch { } };
  if (window.turnstile) go(); else { const s = document.createElement("script"); s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"; s.async = true; s.onload = go; document.head.append(s) }
};
const pwf = (id, lbl, ac, extra) => `<div class="fld"><label for="${id}">${lbl}</label><div class="pwr"><input id="${id}" type="password" autocomplete="${ac}" ${extra || ""}><button type="button" class="eye" aria-label="Показать пароль" onclick="eyeTog('${id}')">${IC9.eye}</button></div></div>`;
window.auth = function (mode) {
  const r = mode === "register";
  return `<div class="au"><div class="au-hd"><i class="kico"></i><h1>${r ? "Регистрация" : "Вход"}</h1></div>
  <div class="fld"><label for="em">Email</label><input id="em" type="email" autocomplete="email" inputmode="email" autocapitalize="off" placeholder="name@example.com"></div>
  ${r ? '<div class="fld"><label for="un">Имя пользователя</label><input id="un" autocomplete="username" autocapitalize="off" maxlength="24" placeholder="3–24 символа"></div>' : ""}
  ${pwf("pw", r ? "Пароль" : "Пароль", r ? "new-password" : "current-password", `onkeydown="if(event.key==='Enter')doAuth('${mode}')" ${r ? 'placeholder="Минимум 8 символов"' : ""}`)}
  ${r ? '<label class="au-chk"><input type="checkbox" id="cs"><span>Хочу продавать и подписываю <a class="lk" onclick="event.preventDefault();codeRules()">Кодекс продавца</a></span></label>' : ""}
  ${r ? HP9 + CF9 : ""}<button class="au-btn" onclick="doAuth('${mode}')">${r ? "Создать аккаунт" : "Войти"}</button>
  <div class="au-links">${r ? `<a onclick="go('/login')">Уже есть аккаунт? Войти</a>` : `<a onclick="go('/register')">Регистрация</a><a onclick="go('/reset')">Забыли пароль?</a>`}</div>
  ${r ? `<p class="au-hint">Регистрируясь, вы принимаете <a class="lk" onclick="go('/legal/terms')">Пользовательское соглашение</a> и <a class="lk" onclick="go('/legal/privacy')">Политику конфиденциальности</a>.</p>` : ""}</div>`;
};
window.resetPage = async function () {
  let info = {}; try { info = await api("/auth/reset/info") } catch { }
  const can = info.email || info.telegram;
  const via = info.telegram && info.email ? "в Telegram или на почту" : info.telegram ? "в Telegram" : "на почту";
  const lead = !can ? "Автоматическая отправка кодов сейчас недоступна. Напишите в поддержку: сотрудник выдаст одноразовый код после проверки."
    : "Мы пришлём одноразовый код " + via + (info.telegram ? ". Для Telegram он должен быть привязан в «Настройках» заранее" : "") + ". Код действует 15 минут.";
  return `<div class="au"><div class="au-hd"><i class="kico"></i><h1>Сброс пароля</h1></div><p class="au-s">${lead}</p>
  <div class="au-st"><span class="n">1.</span>Получите код<small>Введите email вашего аккаунта</small></div>
  <div class="fld"><label for="rem">Email</label><input id="rem" type="email" autocomplete="email" inputmode="email" autocapitalize="off" placeholder="name@example.com"></div>
  ${can ? HP9 + CF9 + `<button class="au-btn sec" onclick="resetReq()">Отправить код</button>` : ""}
  <hr class="au-sep">
  <div class="au-st"><span class="n">2.</span>Задайте новый пароль<small>Введите код и придумайте пароль</small></div>
  <div class="fld"><label for="rco">Код</label><input id="rco" autocomplete="one-time-code" autocapitalize="characters" maxlength="12" placeholder="Код из сообщения"></div>
  ${pwf("rpw", "Новый пароль", "new-password", 'placeholder="Минимум 8 символов"')}
  <button class="au-btn" onclick="resetDo()">Сменить пароль</button>
  <p class="au-hint">Код не пришёл? Проверьте «Спам» и привязку Telegram. Повторно код можно запросить через минуту.</p>
  <div class="au-links"><a onclick="go('/legal/contacts')">Контакты поддержки</a><a onclick="go('/login')">Вход</a></div></div>`;
};
// ---- настройки: безопасность
const _sp = window.settingsPage;
window.settingsPage = function () {
  const base = _sp();
  return ME ? `<h2>Настройки</h2><div class="secw" id="secp"><div class="card sx"><div class="sk"></div></div></div>` + base.replace("<h2>Настройки</h2>", "") : base;
};
async function secRender() {
  const box = document.getElementById("secp"); if (!box) return;
  let s, tg = { configured: false, linked: false }; try { s = await api("/me/security") } catch { box.remove(); return } try { tg = await api("/me/telegram") } catch { }
  const hd = (ic, t, sub, pill) => `<div class="sech"><span class="si2">${ic}</span><span><b>${t}</b><small>${sub}</small>${pill || ""}</span></div>`;
  const fl = (id, lbl, ac, ph) => `<div class="fld"><label for="${id}">${lbl}</label><div class="pwr"><input id="${id}" type="password" autocomplete="${ac}" ${ph ? `placeholder="${ph}"` : ""}><button type="button" class="eye" aria-label="Показать" onclick="eyeTog('${id}')">${IC9.eye}</button></div></div>`;
  box.innerHTML = `<div class="card sx secc">${hd('<svg viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg>', "Пароль", "Смена пароля для входа")}
  ${fl("pwc", "Текущий пароль", "current-password")}${fl("pwn", "Новый пароль", "new-password", "Минимум 8 символов")}${fl("pwn2", "Повторите новый пароль", "new-password")}
  <button class="btn pri" onclick="pwChange()">Сменить пароль</button></div>
  <div class="card sx secc">${hd('<svg viewBox="0 0 24 24"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>', "Двухэтапная аутентификация", "Дополнительная защита аккаунта", `<span class="pill ${s.twofa ? "ok" : ""}">${s.twofa ? "Включена" : "Выключена"}</span>`)}
  <p class="sp">При входе, кроме пароля, нужен одноразовый код из приложения-аутентификатора (Google Authenticator, Authy, 2FAS и др.).</p>
  <div id="tfbox">${s.twofa
    ? `<p class="sp">Неиспользованных резервных кодов: ${s.backup_left}</p>${fl("tfp", "Пароль", "current-password")}<div class="fld"><label for="tfd">Код из приложения или резервный код</label><input id="tfd" inputmode="numeric" autocomplete="one-time-code"></div><button class="btn dng" onclick="tfOff()">Выключить</button>`
    : `<button class="btn pri" onclick="tfStart()">Включить</button>`}</div></div>
  <div class="card sx secc">${hd('<svg viewBox="0 0 24 24"><path d="M21 4L3 11l6 2 2 6 3-4 5 3z"/></svg>', "Telegram", "Коды сброса пароля приходят сюда", tg.configured ? `<span class="pill ${tg.linked ? "ok" : ""}">${tg.linked ? "Привязан" : "Не привязан"}</span>` : "")}
  ${!tg.configured ? '<p class="sp">Бот пока не настроен на сайте.</p>' : tg.linked ? '<p class="sp">Код для сброса придёт в этот Telegram.</p><button class="btn" onclick="tgUnlink()">Отвязать</button>' : '<p class="sp">Привяжите заранее, чтобы восстановить пароль без почты: откроется бот, нажмите «Старт».</p><button class="btn pri" onclick="tgLink()">Привязать Telegram</button>'}</div>`;
}
window.pwChange = act(async () => {
  const a = $("#pwc").value, b = $("#pwn").value, c = $("#pwn2").value;
  if (!a || !b) throw new Error("Заполните все поля"); if (b.length < 8) throw new Error("Новый пароль: минимум 8 символов"); if (b !== c) throw new Error("Пароли не совпадают");
  await api("/me/password", { method: "POST", body: { current: a, password: b } });
  ["#pwc", "#pwn", "#pwn2"].forEach(i => $(i).value = ""); toast("Пароль изменён");
});
window.tfStart = act(async () => {
  const r = await api("/me/2fa/setup", { method: "POST" });
  $("#tfbox").innerHTML = `<p class="m" style="margin:6px 0 0">1. Откройте приложение-аутентификатор и добавьте аккаунт по ключу (на телефоне можно нажать кнопку ниже).</p><span class="kcode">${esc(r.secret.replace(/(.{4})/g, "$1 ").trim())}</span><div class="row"><a class="btn" href="${esc(r.uri)}">Открыть в приложении</a><button class="btn" onclick="navigator.clipboard&&navigator.clipboard.writeText('${esc(r.secret)}').then(()=>toast('Ключ скопирован'))">Копировать ключ</button></div><p class="m">2. Введите 6-значный код из приложения.</p><input id="tfc2" inputmode="numeric" maxlength="7" autocomplete="one-time-code" placeholder="123456"><button class="btn pri" style="margin-top:10px" onclick="tfOn()">Подтвердить и включить</button>`;
});
window.tfOn = act(async () => {
  const r = await api("/me/2fa/enable", { method: "POST", body: { code: $("#tfc2").value } });
  $("#tfbox").innerHTML = `<p class="ok">Двухэтапная аутентификация включена</p><p class="m" style="margin:0 0 6px">Сохраните резервные коды: каждый подходит один раз, если не будет доступа к приложению. Показываем их только сейчас.</p><div class="bk8">${r.backup_codes.map(c => `<span>${esc(c)}</span>`).join("")}</div><button class="btn" style="margin-top:10px" onclick="navigator.clipboard&&navigator.clipboard.writeText('${r.backup_codes.join(" ")}').then(()=>toast('Коды скопированы'))">Копировать коды</button> <button class="btn pri" style="margin-top:10px" onclick="secRender()">Готово</button>`;
});
window.tfOff = act(async () => {
  await api("/me/2fa/disable", { method: "POST", body: { password: $("#tfp").value, code: $("#tfd").value } });
  toast("Двухэтапная аутентификация выключена"); secRender();
});
window.tgLink = act(async () => { const r = await api("/me/telegram/link", { method: "POST" }); window._tgw = 1; location.href = r.url });
window.tgUnlink = act(async () => { const r = await api("/me/telegram/unlink", { method: "POST" }); toast(r.linked ? "Этот Telegram нужен для подтверждения продавца, отвязать нельзя" : "Telegram отвязан"); secRender() });
document.addEventListener("visibilitychange", () => { if (!document.hidden && /^#\/settings/.test(location.hash)) setTimeout(secRender, 400) });
window.secRender = secRender;
function sndCard() {
  const cur = (() => { try { return localStorage.dp_tone || "soft" } catch { return "soft" } })();
  return `<div class="card" id="sndc" style="margin-top:12px"><b>Звук уведомлений</b><p class="m" style="margin:4px 0 0">Нажмите на вариант, чтобы выбрать и услышать. Применяется сразу. Громкость и включение звука настраиваются выше.</p><div class="tnl">${Object.entries(SFX.TONES).map(([k, n]) => `<button type="button" class="${k === cur ? "on" : ""}" onclick="toneSet('${k}')">${n}</button>`).join("")}</div></div>`;
}
window.toneSet = k => { try { localStorage.dp_tone = k } catch { } const c = document.getElementById("sndc"); if (c) c.outerHTML = sndCard(); SFX.play("notify", true) };
function mountSnd() { const st = document.getElementById("stc"); if (st && !document.getElementById("sndc")) st.insertAdjacentHTML("afterend", sndCard()) }
// проверка почты (админ → вкладка «Боты и хранилище»)
const _bv = window.botsView;
window.botsView = async function () { return (await _bv()) + `<div class="card"><b>Почта (коды сброса пароля)</b><p class="m" style="margin:4px 0 8px">Отправит тестовое письмо на email вашего аккаунта и покажет причину, если не получилось.</p><button class="btn pri" onclick="mailTest()">Отправить тестовое письмо</button><div id="mres" style="margin-top:10px"></div></div>` };
window.mailTest = act(async () => { $("#mres").innerHTML = '<div class="sk"></div>'; const r = await api("/admin/mail/test", { method: "POST" }); $("#mres").innerHTML = r.ok ? `<span class="ok">Письмо отправлено на ${esc(r.to)}. Проверьте почту и «Спам».</span>` : `<span style="color:var(--bad,#f87171);overflow-wrap:anywhere">Ошибка: ${esc(r.error)}</span>` });
const _ar9 = window.afterRoute;
window.afterRoute = function () { const r = _ar9 && _ar9.apply(this, arguments); if (/^#\/settings/.test(location.hash)) { secRender(); setTimeout(mountSnd, 60) } if (/^#\/(register|reset)/.test(location.hash)) setTimeout(cfMount, 80); return r };
