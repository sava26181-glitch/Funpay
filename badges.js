// Настоящие достижения продавца: считаются из заказов, споров и переписки, а не выбираются вручную.
export function makeBadges(q) {
  const cache = new Map(), top = { at: 0, ids: new Map() };
  const DEFS = {
    deals100: { title: "100 сделок без спора", desc: "100 завершённых заказов, по которым не открывались споры" },
    fast: { title: "Мгновенный ответ", desc: "Медианное время ответа покупателю до 5 минут за последние 30 дней (минимум 5 диалогов)" },
    battle: { title: "Победитель недели", desc: "Победил в еженедельной битве магазинов своей категории" },
    top: { title: "Топ недели", desc: "Входит в тройку продавцов по числу завершённых заказов за 7 дней (минимум 3)" }
  };
  async function topWeek() {
    if (Date.now() - top.at < 60000) return top.ids;
    const rows = await q("select o.seller_id,count(*)::int n from order_events e join orders o on o.id=e.order_id where e.status='completed' and e.created_at>now()-interval '7 days' group by o.seller_id order by n desc limit 3");
    top.at = Date.now(); top.ids = new Map(rows.filter(r => r.n >= 3).map((r, i) => [r.seller_id, { rank: i + 1, n: r.n }])); return top.ids;
  }
  async function stats(ids) {
    const [deals, resp] = await Promise.all([
      q("select o.seller_id,(count(*) filter (where not exists(select 1 from disputes d where d.order_id=o.id)))::int clean from orders o where o.seller_id=any($1) and o.status='completed' group by o.seller_id", [ids]),
      q(`select c.seller_id,(percentile_cont(0.5) within group (order by extract(epoch from (r.t-b.t))))::float med,count(*)::int n
         from conversations c
         join lateral (select created_at t from messages m where m.conversation_id=c.id and m.sender_id=c.buyer_id order by created_at limit 1) b on true
         join lateral (select created_at t from messages m where m.conversation_id=c.id and m.sender_id=c.seller_id and m.created_at>b.t order by created_at limit 1) r on true
         where c.seller_id=any($1) and b.t>now()-interval '30 days' group by c.seller_id`, [ids])]);
    return { deals: new Map(deals.map(r => [r.seller_id, r.clean])), resp: new Map(resp.map(r => [r.seller_id, r])) };
  }
  async function progressMany(ids) {
    const need = ids.filter(id => !(cache.get(id) && Date.now() - cache.get(id).at < 30000));
    if (need.length) {
      const s = await stats(need), t = await topWeek();
      for (const id of need) {
        const clean = s.deals.get(id) || 0, r = s.resp.get(id) || null, tp = t.get(id) || null;
        cache.set(id, { at: Date.now(), p: {
          deals: { clean, goal: 100, earned: clean >= 100 },
          fast: { median_sec: r ? Math.round(r.med) : null, samples: r ? r.n : 0, goal_samples: 5, goal_sec: 300, earned: !!r && r.n >= 5 && r.med <= 300 },
          top: { rank: tp ? tp.rank : null, orders: tp ? tp.n : 0, earned: !!tp } } });
      }
    }
    return Object.fromEntries(ids.map(id => [id, cache.get(id).p]));
  }
  const earned = p => [["deals100", p.deals.earned], ["fast", p.fast.earned], ["top", p.top.earned]].filter(x => x[1]).map(x => ({ key: x[0], ...DEFS[x[0]] }));
  return {
    DEFS,
    async badgesFor(ids) {
      ids = [...new Set(ids.filter(Boolean))]; if (!ids.length) return {}; const p = await progressMany(ids);
      const bw = new Set((await q("select distinct winner_id from battles where status='done' and winner_id=any($1) and finished_at>now()-interval '7 days'", [ids]).catch(() => [])).map(r => r.winner_id));
      return Object.fromEntries(ids.map(id => [id, [...earned(p[id]), ...(bw.has(id) ? [{ key: "battle", ...DEFS.battle }] : [])]]));
    },
    async progress(id) { return (await progressMany([id]))[id]; }
  };
}
