// v11: дуэли магазинов (24 часа, очки за качество, призы: бонус на баланс и буст в каталоге)
export default function routes6(app, { q, pool, tx, E, wrap, need, hooks, pushUser }) {
  const uuid = s => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s || ""));
  const DUR_H = 24, BUYER_CAP = 150, MIN_ORDER = 5000, MIN_AGE_D = 3, BONUS_PCT = 0.01, BONUS_MAX = 50000, BOOST_H = 12, K = 24;
  const LEAGUES = [["Бронза", 0], ["Серебро", 500000], ["Золото", 5000000], ["Платина", 30000000]];
  const league = t => { let i = 0; LEAGUES.forEach((l, k) => { if (t >= l[1]) i = k }); return i };
  const lname = i => LEAGUES[i][0];
  // очки продавца за окно [from,to). Возвращает разбивку и события для ленты.
  async function scoreOf(c, seller, cat, opp, from, to, game) {
    const { rows: os } = await c.query(`select o.id,o.buyer_id,o.total_cents,e.created_at at from order_events e join orders o on o.id=e.order_id join listings l on l.id=o.listing_id join users b on b.id=o.buyer_id
      where e.status='completed' and o.seller_id=$1 and l.category_id=$2 and ($8::uuid is null or l.game_id=$8) and e.created_at>=$3 and e.created_at<$4 and o.buyer_id<>$1 and o.buyer_id<>$5 and o.total_cents>=$6 and b.created_at<=e.created_at-($7||' days')::interval and not exists(select 1 from user_fp fa join user_fp fb on fa.kind=fb.kind and fa.hash=fb.hash where fa.user_id=$1 and fb.user_id=o.buyer_id) order by e.created_at`, [seller, cat, from, to, opp, MIN_ORDER, String(MIN_AGE_D), game || null]);
    const used = new Map(), ev = []; let orders = 0, unique = 0, sum = 0, capped = 0;
    for (const o of os) {
      const first = !used.has(o.buyer_id), raw = 40 + (first ? 30 : 5), room = Math.max(0, BUYER_CAP - (used.get(o.buyer_id) || 0)), pts = Math.min(raw, room);
      used.set(o.buyer_id, (used.get(o.buyer_id) || 0) + pts); orders += Math.min(40, pts); unique += Math.max(0, pts - 40); if (pts < raw) capped++;
      sum += Number(o.total_cents); ev.push({ t: o.at, pts, text: pts ? (first ? "Заказ завершён, новый покупатель" : "Заказ завершён, повторный покупатель") : "Заказ завершён (лимит очков с одного покупателя исчерпан)" });
    }
    const { rows: [fl] } = await c.query(`select count(*)::int n from order_events e join orders o on o.id=e.order_id join listings l on l.id=o.listing_id where e.status='completed' and o.seller_id=$1 and l.category_id=$2 and ($5::uuid is null or l.game_id=$5) and e.created_at>=$3 and e.created_at<$4 and o.buyer_id<>$1 and exists(select 1 from user_fp fa join user_fp fb on fa.kind=fb.kind and fa.hash=fb.hash where fa.user_id=$1 and fb.user_id=o.buyer_id)`, [seller, cat, from, to, game || null]);
    // скорость ответа: первое сообщение покупателя в новом диалоге по лоту этой категории; ответ до 5 минут +15, позже 60 минут или без ответа −10
    const { rows: dg } = await c.query(`select distinct on (m.sender_id) m.created_at at, (select min(r.created_at) from messages r where r.conversation_id=m.conversation_id and r.sender_id=$1 and r.created_at>m.created_at) reply
      from messages m join conversations cv on cv.id=m.conversation_id join listings l on l.id=m.listing_id join users su on su.id=m.sender_id
      where $1 in(cv.buyer_id,cv.seller_id) and m.sender_id<>$1 and m.sender_id<>$5 and l.seller_id=$1 and l.category_id=$2 and ($7::uuid is null or l.game_id=$7) and m.created_at>=$3 and m.created_at<$4 and su.created_at<=m.created_at-($6||' days')::interval
        and not exists(select 1 from messages p where p.conversation_id=m.conversation_id and p.created_at<m.created_at and p.created_at>m.created_at-interval '30 minutes')
        and not exists(select 1 from user_fp fa join user_fp fb on fa.kind=fb.kind and fa.hash=fb.hash where fa.user_id=$1 and fb.user_id=m.sender_id)
      order by m.sender_id,m.created_at`, [seller, cat, from, to, opp, String(MIN_AGE_D), game || null]);
    let speed = 0; for (const x of dg) { const wait = x.reply ? (new Date(x.reply) - new Date(x.at)) / 6e4 : (Math.min(Date.now(), new Date(to)) - new Date(x.at)) / 6e4; let p = 0; if (x.reply && wait <= 5) p = 15; else if (wait > 60) p = -10; if (p) { speed += p; ev.push({ t: x.reply || x.at, pts: p, text: p > 0 ? "Быстрый ответ покупателю (до 5 минут)" : "Покупатель ждал ответа больше часа" }) } }
    speed = Math.max(-50, Math.min(100, speed));
    const amount = Math.min(300, Math.floor(sum / 10000)), { rows: rv } = await c.query(`select r.rating,r.created_at from reviews r join orders o on o.id=r.order_id join listings l on l.id=o.listing_id where r.seller_id=$1 and l.category_id=$2 and ($6::uuid is null or l.game_id=$6) and r.created_at>=$3 and r.created_at<$4 and r.reviewer_id<>$5 and r.rating>=4 and not exists(select 1 from user_fp fa join user_fp fb on fa.kind=fb.kind and fa.hash=fb.hash where fa.user_id=$1 and fb.user_id=r.reviewer_id) order by r.created_at`, [seller, cat, from, to, opp, game || null]);
    let reviews = 0; for (const r of rv) { const p = r.rating === 5 ? 50 : 20; reviews += p; ev.push({ t: r.created_at, pts: p, text: `Отзыв ${r.rating}★` }) }
    const { rows: [rf] } = await c.query("select count(*)::int n from orders o join listings l on l.id=o.listing_id where o.seller_id=$1 and l.category_id=$2 and ($5::uuid is null or l.game_id=$5) and o.payment_status='refunded' and o.updated_at>=$3 and o.updated_at<$4", [seller, cat, from, to, game || null]);
    const refunds = -40 * rf.n; if (rf.n) ev.push({ t: to < new Date() ? to : new Date(), pts: refunds, text: `Возвраты покупателям: ${rf.n}` });
    const total = Math.max(0, orders + unique + amount + reviews + refunds + speed);
    return { total, orders, unique, amount, reviews, refunds, speed, flagged: fl.n, sum_cents: sum, capped, events: ev };
  }
  async function turnover(c, uid) { const { rows: [r] } = await c.query("select coalesce(sum(total_cents),0)::bigint tt from orders where seller_id=$1 and status='completed' and updated_at>now()-interval '30 days'", [uid]); return Number(r.tt) }
  async function finishDuels(c) {
    const { rows: ds } = await c.query("select * from duels where status='live' and ends_at<=now() for update");
    for (const d of ds) {
      const A = await scoreOf(c, d.seller_a, d.category_id, d.seller_b, d.starts_at, d.ends_at, d.game_id), B = await scoreOf(c, d.seller_b, d.category_id, d.seller_a, d.starts_at, d.ends_at, d.game_id);
      const win = A.total > B.total ? d.seller_a : B.total > A.total ? d.seller_b : null, ra = d.rating_a ?? 1000, rb = d.rating_b ?? 1000, ea = 1 / (1 + 10 ** ((rb - ra) / 400)), sa = win === d.seller_a ? 1 : win ? 0 : .5;
      const na = Math.round(ra + K * (sa - ea)), nb = Math.round(rb + K * ((1 - sa) - (1 - ea)));
      let bonus = 0; if (win) { const w = win === d.seller_a ? A : B; bonus = Math.min(BONUS_MAX, Math.floor(w.sum_cents * BONUS_PCT)); if (bonus > 0) await hooks.move?.(c, win, "adjustment", bonus / 100, "duel", d.id, "duel:" + d.id); await c.query("insert into duel_boosts(user_id,until,fee_until) values($1,now()+($2||' hours')::interval,now()+interval '7 days') on conflict(user_id) do update set until=greatest(duel_boosts.until,excluded.until),fee_until=greatest(coalesce(duel_boosts.fee_until,now()),excluded.fee_until)", [win, String(BOOST_H)]); }
      await c.query("update duels set status='done',score_a=$2,score_b=$3,winner_id=$4,bonus_cents=$5,finished_at=now() where id=$1", [d.id, A.total, B.total, win, bonus]);
      for (const [uid, nr, won] of [[d.seller_a, na, win === d.seller_a], [d.seller_b, nb, win === d.seller_b]]) {
        const lost = win && !won;
        await c.query("insert into duel_rating(user_id,rating,wins,losses,streak) values($1,$2,$3,$4,$5) on conflict(user_id) do update set rating=$2,wins=duel_rating.wins+$3,losses=duel_rating.losses+$4,streak=case when $3=1 then greatest(duel_rating.streak,0)+1 when $4=1 then least(duel_rating.streak,0)-1 else 0 end", [uid, Math.max(100, nr), won ? 1 : 0, lost ? 1 : 0, won ? 1 : lost ? -1 : 0]);
        const { rows: [n] } = await c.query("insert into notifications(user_id,type,payload) values($1,'duel_end',$2) returning id,payload", [uid, { won: !!won, tie: !win, bonus: won ? bonus / 100 : 0 }]);
        try { pushUser?.(uid, "notify", { id: n.id, type: "duel_end", ...n.payload }) } catch { }
      }
    }
  }
  async function matchAll(c) {
    const { rows: cs } = await c.query(`select user_id,game_id,category_id,since,rating,turnover,last_opp from (
      select distinct on (u.id) u.id user_id,x.game_id,x.category_id,x.since,coalesce(r.rating,1000) rating,
        (select coalesce(sum(total_cents),0)::bigint from orders where seller_id=u.id and status='completed' and updated_at>now()-interval '30 days') turnover,
        (select case when d.seller_a=u.id then d.seller_b else d.seller_a end from duels d where u.id in(d.seller_a,d.seller_b) order by d.starts_at desc limit 1) last_opp
      from (select user_id,game_id,category_id,joined_at since from duel_queue where game_id is not null union all select user_id,game_id,category_id,created_at from duel_auto) x
      join users u on u.id=x.user_id left join duel_rating r on r.user_id=u.id
      join seller_codes sc on sc.user_id=u.id and sc.revoked_at is null
      where (u.blocked_until is null or u.blocked_until<now())
        and exists(select 1 from listings l where l.seller_id=u.id and l.category_id=x.category_id and l.game_id=x.game_id and l.status='active' and l.stock>0)
        and not exists(select 1 from duels d where u.id in(d.seller_a,d.seller_b) and (d.status='live' or d.starts_at>now()-interval '24 hours'))
      order by u.id,x.since) t`);
    const byCat = new Map(); cs.forEach(x => { const k = x.game_id + "|" + x.category_id; if (!byCat.has(k)) byCat.set(k, []); byCat.get(k).push(x) });
    for (const [key, arr] of byCat) { const [gid, cat] = key.split("|");
      arr.sort((a, b) => a.rating - b.rating); const used = new Set();
      for (let i = 0; i < arr.length; i++) {
        const a = arr[i]; if (used.has(a.user_id)) continue; let best = null;
        for (let j = i + 1; j < arr.length; j++) {
          const b = arr[j]; if (used.has(b.user_id)) continue;
          const waitMin = (Date.now() - Math.min(new Date(a.since), new Date(b.since))) / 60000, dl = Math.abs(league(Number(a.turnover)) - league(Number(b.turnover))), allow = Math.min(600, 150 + 150 * Math.floor(waitMin / 10));
          if (dl > (waitMin > 30 ? 1 : 0) || Math.abs(a.rating - b.rating) > allow) continue; if ((a.last_opp === b.user_id || b.last_opp === a.user_id) && waitMin < 60) continue;
          if (!best || Math.abs(a.rating - b.rating) < Math.abs(a.rating - best.rating)) best = b;
        }
        if (best) { used.add(a.user_id); used.add(best.user_id); await c.query("insert into duels(game_id,category_id,seller_a,seller_b,ends_at,rating_a,rating_b) values($1,$2,$3,$4,now()+($5||' hours')::interval,$6,$7)", [gid, cat, a.user_id, best.user_id, String(DUR_H), a.rating, best.rating]); await c.query("delete from duel_queue where user_id in($1,$2)", [a.user_id, best.user_id]);
          for (const u of [a.user_id, best.user_id]) { try { pushUser?.(u, "notify", { type: "duel_start" }) } catch { } } }
      }
    }
  }
  const run = () => tx(async c => { await c.query("select pg_advisory_xact_lock(515151)"); await finishDuels(c); await matchAll(c); }).catch(e => console.error("[duels]", e.message));
  const DSEL = `select d.id,d.game_id,g.name game_name,d.category_id,c.name category_name,d.seller_a,d.seller_b,ua.username name_a,ub.username name_b,ua.avatar_media av_a,ub.avatar_media av_b,d.starts_at,d.ends_at,d.status,d.score_a,d.score_b,d.winner_id,d.bonus_cents,d.rating_a,d.rating_b from duels d join categories c on c.id=d.category_id left join games g on g.id=d.game_id join users ua on ua.id=d.seller_a join users ub on ub.id=d.seller_b`;
  const strip = s => { const { events, ...r } = s; return r };
  app.get("/api/duels", wrap(async (req, res) => {
    await run(); const uid = req.user?.id;
    const live = await q(`${DSEL} where d.status='live' order by d.ends_at limit 30`);
    for (const d of live) { await tx(async c => { d.live_a = strip(await scoreOf(c, d.seller_a, d.category_id, d.seller_b, d.starts_at, new Date(), d.game_id)); d.live_b = strip(await scoreOf(c, d.seller_b, d.category_id, d.seller_a, d.starts_at, new Date(), d.game_id)); }); d.score_a = d.live_a.total; d.score_b = d.live_b.total; }
    const done = await q(`${DSEL} where d.status='done' order by d.finished_at desc limit 10`);
    const gr = await q(`select g.id,g.slug,g.name,count(l.id)::int lots,coalesce(sum((select count(*) from orders o where o.listing_id=l.id and o.created_at>now()-interval '30 days')),0)::int orders30 from games g join listings l on l.game_id=g.id and l.status='active' and l.stock>0 group by g.id order by (count(l.id)+3*coalesce(sum((select count(*) from orders o where o.listing_id=l.id and o.created_at>now()-interval '30 days')),0)) desc, g.name limit 40`);
    const gc = await q("select l.game_id,c.id,c.name,count(*)::int lots,bool_or(l.seller_id=$1) mine from listings l join categories c on c.id=l.category_id where l.status='active' and l.stock>0 group by l.game_id,c.id,c.name order by count(*) desc", [uid || null]);
    const liveBy = {}; live.forEach(x => { liveBy[x.game_id] = (liveBy[x.game_id] || 0) + 1 });
    const games = gr.map(g => ({ ...g, duels: liveBy[g.id] || 0, cats: gc.filter(c => c.game_id === g.id).map(({ game_id, ...c }) => c) }));
    let me = null; if (uid) {
      const [r] = await q("select rating,wins,losses,streak from duel_rating where user_id=$1", [uid]), [qq] = await q("select game_id,category_id,joined_at from duel_queue where user_id=$1", [uid]), auto = await q("select game_id,category_id from duel_auto where user_id=$1", [uid]);
      const t = await turnover({ query: pool.query.bind(pool) }, uid), [nx] = await q("select max(starts_at)+interval '24 hours' nxt from duels where $1 in(seller_a,seller_b)", [uid]);
      me = { rating: r?.rating ?? 1000, wins: r?.wins ?? 0, losses: r?.losses ?? 0, streak: r?.streak ?? 0, league: lname(league(t)), turnover_cents: t, queue: qq || null, auto, next_at: nx?.nxt && new Date(nx.nxt) > new Date() ? nx.nxt : null, boost_until: (await q("select until from duel_boosts where user_id=$1 and until>now()", [uid]))[0]?.until || null };
    }
    res.json({ live, done, games, me, rules: { duration_h: DUR_H, buyer_cap: BUYER_CAP, min_order: MIN_ORDER / 100, min_age_days: MIN_AGE_D, bonus_pct: BONUS_PCT * 100, bonus_max: BONUS_MAX / 100, boost_h: BOOST_H } });
  }));
  app.get("/api/duels/:id/log", wrap(async (req, res) => {
    if (!uuid(req.params.id)) throw E(404, "not found"); const [d] = await q(`${DSEL} where d.id=$1`, [req.params.id]); if (!d) throw E(404, "not found");
    const to = d.status === "live" ? new Date() : d.ends_at;
    const out = await tx(async c => { const A = await scoreOf(c, d.seller_a, d.category_id, d.seller_b, d.starts_at, to, d.game_id), B = await scoreOf(c, d.seller_b, d.category_id, d.seller_a, d.starts_at, to, d.game_id); return { a: strip(A), b: strip(B), log: [...A.events.map(e => ({ ...e, side: "a" })), ...B.events.map(e => ({ ...e, side: "b" }))].sort((x, y) => new Date(y.t) - new Date(x.t)).slice(0, 30) } });
    res.json({ ...out, d });
  }));
  const okSeller = async uid => { const [s] = await q("select 1 from users u join seller_codes sc on sc.user_id=u.id and sc.revoked_at is null where u.id=$1 and u.is_seller", [uid]); if (!s) throw E(403, "sign seller code first"); };
  const slot = async b => {
    if (!uuid(b?.categoryId) || !uuid(b?.gameId)) throw E(400, "invalid input");
    const [has] = await q("select 1 from listings where seller_id=$1 and category_id=$2 and game_id=$3 and status='active' and stock>0 limit 1", [b._uid, b.categoryId, b.gameId]); if (!has) throw E(409, "need active listing in this game and category");
  };
  app.post("/api/duels/find", need, wrap(async (req, res) => {
    await okSeller(req.user.id); await slot({ ...req.body, _uid: req.user.id });
    const [busy] = await q("select 1 from duels d where $1 in(d.seller_a,d.seller_b) and (d.status='live' or d.starts_at>now()-interval '24 hours')", [req.user.id]); if (busy) throw E(409, "duel limit: one per 24h");
    await q("insert into duel_queue(user_id,game_id,category_id) values($1,$2,$3) on conflict(user_id) do update set game_id=$2,category_id=$3,joined_at=now()", [req.user.id, req.body.gameId, req.body.categoryId]);
    await run(); res.json({ ok: true });
  }));
  app.post("/api/duels/cancel", need, wrap(async (req, res) => { await q("delete from duel_queue where user_id=$1", [req.user.id]); res.json({ ok: true }); }));
  app.post("/api/duels/auto", need, wrap(async (req, res) => {
    if (!uuid(req.body?.categoryId) || !uuid(req.body?.gameId)) throw E(400, "invalid input");
    if (req.body.on === false) { await q("delete from duel_auto where user_id=$1 and game_id=$2 and category_id=$3", [req.user.id, req.body.gameId, req.body.categoryId]); return res.json({ ok: true }); }
    await okSeller(req.user.id); await slot({ ...req.body, _uid: req.user.id });
    await q("insert into duel_auto(user_id,game_id,category_id) values($1,$2,$3) on conflict do nothing", [req.user.id, req.body.gameId, req.body.categoryId]); await run(); res.json({ ok: true });
  }));
}
