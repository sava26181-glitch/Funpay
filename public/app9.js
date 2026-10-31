// v24: сброс пароля по коду с почты, смена пароля и двухэтапная аутентификация в настройках
Object.assign(ERR, {
  "wrong 2fa code": "Неверный код. Проверьте код в приложении или введите резервный код",
  "wrong password": "Неверный пароль",
  "too many attempts": "Слишком много попыток. Подождите 15 минут",
  "2fa already enabled": "Двухэтапная аутентификация уже включена"
});

// ---- сброс пароля
window.resetPage = async function () {
  let info = {}; try { info = await api("/auth/reset/info") } catch { }
  const lead = info.email ? "Введите email аккаунта. Мы отправим на него одноразовый код, он действует 15 минут."
    : "Отправка кодов на почту сейчас недоступна. Напишите в поддержку: сотрудник выдаст одноразовый код после проверки.";
  return `<div class="card" style="max-width:420px;margin:30px auto"><h2 style="margin-top:0">Сброс пароля</h2><p class="m">${lead}</p><label>Email</label><input id="rem" type="email" autocomplete="email">${info.email ? `<button class="btn" style="width:100%;margin-top:10px" onclick="resetReq()">Отправить код на почту</button>` : ""}<hr style="border:0;border-top:1px solid var(--b);margin:16px 0"><label>Код</label><input id="rco" autocomplete="one-time-code" autocapitalize="characters" maxlength="12" inputmode="text"><label>Новый пароль (минимум 8 символов)</label><input id="rpw" type="password" autocomplete="new-password"><button class="btn pri" style="width:100%;margin-top:12px" onclick="resetDo()">Сменить пароль</button><p class="m">Письма нет? Проверьте «Спам». Повторно код можно запросить через минуту.</p><p class="m"><a class="lk" onclick="go('/legal/contacts')">Контакты поддержки</a> · <a class="lk" onclick="go('/login')">Вход</a></p></div>`;
};
window.resetReq = act(async () => {
  const e = $("#rem").value.trim(); if (!e) throw new Error("Введите email");
  await api("/auth/reset/request", { method: "POST", body: { email: e } });
  toast("Код отправлен на почту. Он действует 15 минут");
  $("#rco")?.focus();
});

// ---- настройки: безопасность
const _sp = window.settingsPage;
window.settingsPage = function () {
  const base = _sp();
  return ME ? `<h2>Настройки</h2><div class="card secc" id="secp"><div class="sk"></div></div>` + base.replace("<h2>Настройки</h2>", "") : base;
};
async function secRender() {
  const box = document.getElementById("secp"); if (!box) return;
  let s; try { s = await api("/me/security") } catch { box.remove(); return }
  box.innerHTML = `<div class="sech"><span class="si2"><svg viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg></span><span><b>Пароль</b><small>Смените пароль для входа в аккаунт</small></span></div>
  <label>Текущий пароль</label><input id="pwc" type="password" autocomplete="current-password">
  <label>Новый пароль (минимум 8 символов)</label><input id="pwn" type="password" autocomplete="new-password">
  <label>Повторите новый пароль</label><input id="pwn2" type="password" autocomplete="new-password">
  <button class="btn pri" style="margin-top:10px" onclick="pwChange()">Сменить пароль</button>
  <hr style="border:0;border-top:1px solid var(--b);margin:18px 0">
  <div class="sech"><span class="si2"><svg viewBox="0 0 24 24"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg></span><span><b>Двухэтапная аутентификация</b><small>Дополнительная защита аккаунта</small></span></div>
  <p class="m" style="margin:6px 0 0">При входе, кроме пароля, нужен одноразовый код из приложения-аутентификатора (Google Authenticator, Authy, 2FAS и др.).</p>
  <div id="tfbox">${s.twofa
    ? `<p class="ok">Включена</p><p class="m" style="margin:0">Неиспользованных резервных кодов: ${s.backup_left}</p><label>Пароль</label><input id="tfp" type="password" autocomplete="current-password"><label>Код из приложения или резервный код</label><input id="tfd" inputmode="numeric" autocomplete="one-time-code"><button class="btn dng" style="margin-top:10px" onclick="tfOff()">Выключить</button>`
    : `<p class="m" style="margin:6px 0 0">Сейчас выключена.</p><button class="btn pri" style="margin-top:10px" onclick="tfStart()">Включить</button>`}</div>`;
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
window.afterRoute = function () { const r = _ar9 && _ar9.apply(this, arguments); if (/^#\/settings/.test(location.hash)) { secRender(); setTimeout(mountSnd, 60) } return r };
