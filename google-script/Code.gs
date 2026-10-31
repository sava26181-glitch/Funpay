// DonutPay: отправка писем через Gmail (Google Apps Script). Бесплатно, без сервера.
// Секрет хранится в Свойствах скрипта: SECRET (Настройки проекта -> Свойства скрипта).
function doPost(e) {
  try {
    var o = JSON.parse(e.postData.contents);
    var secret = PropertiesService.getScriptProperties().getProperty("SECRET");
    if (!secret || secret.length < 16 || o.secret !== secret) return out({ error: "bad secret" });
    if (!/^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(String(o.to || "")) || !o.subject || !o.text) return out({ error: "bad fields" });
    GmailApp.sendEmail(String(o.to), String(o.subject).slice(0, 200), String(o.text).slice(0, 5000), { name: "DonutPay" });
    return out({ ok: true });
  } catch (err) { return out({ error: String(err).slice(0, 200) }); }
}
function doGet() { return out({ ok: true, service: "donutpay-gmail-relay" }); }
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
