/* 온라인 방: Supabase Realtime(Presence + Broadcast). 표는 쓰지 않는다 */
const SB_URL = 'https://xavhkigxzoxysirilqnk.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhdmhraWd4em94eXNpcmlscW5rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAzMDUyMTUsImV4cCI6MjEwNTg4MTIxNX0.rITpU9JSawVgvLCzZqXgBWcCgeUbN-kKFJmmN_gdb2o';
let clientP = null;
function client() {
  if (!clientP) clientP = import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm')
    .then(m => m.createClient(SB_URL, SB_KEY, { realtime: { params: { eventsPerSecond: 40 } } }))
    .catch(e => { clientP = null; throw e; });
  return clientP;
}

/**
 * joinRoom({ game, code, me:{id,name}, onMembers(list), onMessage(payload), onStatus(s) })
 * members(): 입장 순서대로 정렬. 첫 번째가 방장(host)
 */
export async function joinRoom({ game, code, me, onMembers = () => {}, onMessage = () => {}, onStatus = () => {} }) {
  const sb = await client();
  const ch = sb.channel(`hammi:${game}:${code}`, { config: { presence: { key: me.id }, broadcast: { self: false, ack: false } } });
  const meta = { id: me.id, name: me.name, joined: Date.now(), ready: false };
  const members = () => Object.values(ch.presenceState()).flat()
    .map(p => { const { presence_ref, ...rest } = p; return rest; })
    .filter(p => p.id)
    .sort((a, b) => a.joined - b.joined || a.id.localeCompare(b.id));
  ch.on('presence', { event: 'sync' }, () => onMembers(members()));
  ch.on('broadcast', { event: 'g' }, ({ payload }) => onMessage(payload));
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), 12000);
    ch.subscribe(async s => {
      onStatus(s);
      if (s === 'SUBSCRIBED') { clearTimeout(t); try { await ch.track(meta); } catch (e) {} resolve(); }
      else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') { clearTimeout(t); reject(new Error(s)); }
    });
  });
  return {
    code, members,
    send: payload => ch.send({ type: 'broadcast', event: 'g', payload: { ...payload, from: me.id } }),
    track: patch => { Object.assign(meta, patch); return ch.track(meta); },
    hostId: () => (members()[0] || {}).id,
    leave: () => sb.removeChannel(ch)
  };
}
