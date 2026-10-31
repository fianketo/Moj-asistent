// Spaja se na WebView aplikacije (Chrome DevTools protokol) i pokreće dijagnostiku obaveštenja.
(async () => {
  const list = await (await fetch('http://localhost:9222/json')).json();
  const ws = new WebSocket(list.find((p) => p.type === 'page').webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let n = 0; const waiting = new Map();
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && waiting.has(d.id)) { waiting.get(d.id)(d); waiting.delete(d.id); } };
  const ev = (label, expr) => new Promise((res) => {
    const id = ++n;
    waiting.set(id, (d) => {
      const r = d.result || {};
      console.log(label, r.exceptionDetails ? 'EXCEPTION ' + JSON.stringify(r.exceptionDetails.exception?.description || r.exceptionDetails.text) : JSON.stringify(r.result?.value));
      res();
    });
    ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression: `(async () => { try { return await (${expr}); } catch (e) { return 'ERR: ' + (e.message || e.code || e); } })()`, awaitPromise: true, returnByValue: true } }));
  });
  await ev('ENV', `({ native: IS_NATIVE, platform: Capacitor.getPlatform(), headers: (Capacitor.PluginHeaders||[]).map(h=>h.name) })`);
  await ev('PERM', `LN.checkPermissions()`);
  await ev('EXACT', `LN.checkExactNotificationSetting()`);
  await ev('CHANNELS', `LN.listChannels().then(r => r.channels.map(c => c.id))`);
  await ev('IMMEDIATE', `LN.schedule({ notifications: [{ id: 501, title: 'CI odmah', body: 'test' }] })`);
  await ev('IMMEDIATE_APP', `LN.schedule({ notifications: [{ id: 502, title: 'CI odmah 2', body: 'test', channelId: 'podsetnici', smallIcon: 'ic_stat_notify' }] })`);
  await ev('SCHEDULED', `LN.schedule({ notifications: [{ id: 503, title: 'CI za 10s', body: 'test', schedule: { at: new Date(Date.now() + 10000), allowWhileIdle: true }, channelId: 'podsetnici', smallIcon: 'ic_stat_notify' }] })`);
  await ev('TESTFN', `testNotification().then(() => 'ok')`);
  await ev('ADD_REMINDER', `(async () => { S.reminders.push({ id: 'ci', title: 'CI podsetnik', at: toLocal(new Date(Date.now() + 5 * 60000)), before: 0, repeat: '', note: '' }); save(); await new Promise(r => setTimeout(r, 2000)); return diag; })()`);
  await ev('PENDING', `LN.getPending().then(r => r.notifications.map(n => [n.id, n.title, n.schedule && n.schedule.at]))`);
  await ev('STATUS', `notifStatus()`);
  ws.close();
})().catch((e) => { console.log('PROBE ERROR', e.message); process.exit(1); });
