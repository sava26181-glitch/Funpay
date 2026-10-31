DonutPay Mail Relay (отправка писем через Яндекс само)

Зачем: на бесплатном Render SMTP-порты закрыты, поэтому сайт не может писать в smtp.yandex.ru напрямую.
Relay — отдельный мини-сервис (Node 20+, без пакетов) на машине, где SMTP разрешён. Сайт шлёт ему HTTPS-запрос, он отправляет письмо.

Запуск (на ПК/VPS):
  cd mail-relay
  cp .env.example .env     # заполнить
  node --env-file=.env relay.js
  (держать запущенным: pm2 start "node --env-file=.env relay.js" --name relay, или systemd)
Relay должен быть доступен сайту по HTTPS-адресу (VPS с доменом/Caddy, либо Cloudflare Tunnel / ngrok для ПК).

На сайте (Render -> Environment):
  MAIL_RELAY_URL=https://ваш-relay-адрес
  MAIL_RELAY_SECRET=тот же RELAY_SECRET
Потом в админке: Боты и хранилище -> «Отправить тестовое письмо».
