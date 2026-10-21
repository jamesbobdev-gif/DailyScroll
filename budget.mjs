export const LIMIT = 3600000;
export function dayKey(date) { return `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`; }
export function inWindow(date, hour) { return date.getHours() === hour; }
export function charge(budget, from, to, hour) {
  let used = budget.used;
  let day = budget.day;
  for (let cursor = from; cursor < to;) {
    const date = new Date(cursor);
    const key = dayKey(date);
    if (key !== day) { day = key; used = 0; }
    const next = Math.min(to, cursor + 1000);
    if (inWindow(date, hour)) used = Math.min(LIMIT, used + next - cursor);
    cursor = next;
  }
  const endDay = dayKey(new Date(to));
  return endDay === day ? {day, used} : {day:endDay, used:0};
}
export function videoId(value) {
  if (/^[\w-]{11}$/.test(value)) return value;
  try {
    const u = new URL(value);
    if (u.hostname === 'youtu.be') return videoId(u.pathname.slice(1));
    if (['youtube.com','www.youtube.com','m.youtube.com'].includes(u.hostname)) {
      const id = u.searchParams.get('v') || u.pathname.match(/^\/(shorts|embed)\/([\w-]{11})/)?.[2];
      return id && /^[\w-]{11}$/.test(id) ? id : null;
    }
  } catch {}
  return null;
}
