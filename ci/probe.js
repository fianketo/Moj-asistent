// Spaja se na WebView aplikacije (Chrome DevTools) i pokreće dijagnostiku obaveštenja.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.connectOverCDP('http://localhost:9222');
  const page = b.contexts()[0].pages()[0];
  page.on('console', (m) => console.log('CONSOLE', m.type(), m.text()));
  const ev = async (label, fn) => {
    try { console.log(label, JSON.stringify(await page.evaluate(fn))); } catch (e) { console.log(label, 'ERR', e.message); }
  };
  await ev('ENV', () => ({ url: location.href, hasCap: !!window.Capacitor, platform: window.Capacitor && Capacitor.getPlatform && Capacitor.getPlatform(),
    native: typeof IS_NATIVE !== 'undefined' ? IS_NATIVE : 'undef', headers: (Capacitor.PluginHeaders || []).map((h) => h.name),
    hasRegister: typeof Capacitor.registerPlugin }));
  await ev('PERM', async () => await LN.checkPermissions());
  await ev('EXACT', async () => await LN.checkExactNotificationSetting());
  await ev('CHANNELS', async () => await LN.listChannels());
  await ev('IMMEDIATE', async () => await LN.schedule({ notifications: [{ id: 501, title: 'CI odmah', body: 'test' }] }));
  await ev('IMMEDIATE_APP', async () => await LN.schedule({ notifications: [{ id: 502, title: 'CI odmah 2', body: 'test', channelId: 'podsetnici', smallIcon: 'ic_stat_notify' }] }));
  await ev('SCHEDULED', async () => await LN.schedule({ notifications: [{ id: 503, title: 'CI za 10s', body: 'test', schedule: { at: new Date(Date.now() + 10000), allowWhileIdle: true }, channelId: 'podsetnici', smallIcon: 'ic_stat_notify' }] }));
  await ev('TESTFN', async () => { await testNotification(); return 'ok'; });
  await ev('ADD_REMINDER', async () => {
    S.reminders.push({ id: 'ci', title: 'CI podsetnik', at: toLocal(new Date(Date.now() + 5 * 60000)), before: 0, repeat: '', note: '' });
    save(); await new Promise((r) => setTimeout(r, 1500)); return diag;
  });
  await ev('PENDING', async () => await LN.getPending());
  await ev('STATUS', async () => await notifStatus());
  await new Promise((r) => setTimeout(r, 3000));
  await b.close();
})().catch((e) => { console.log('PROBE ERROR', e.message); process.exit(1); });
