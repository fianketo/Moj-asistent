// Proverava da li je posle deep linka otvoren prozor za uvoz liste.
(async () => {
  const list = await (await fetch('http://localhost:9222/json')).json();
  const ws = new WebSocket(list.find((p) => p.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (m) => { const d = JSON.parse(m.data); console.log('IMPORT_SHEET', JSON.stringify(d.result && d.result.result && d.result.result.value)); ws.close(); };
  ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: "(() => { const b = document.querySelector('#impOk'); return b ? document.querySelector('#sheet h3').textContent + ' | ' + b.textContent : 'NEMA'; })()", returnByValue: true } }));
})();
