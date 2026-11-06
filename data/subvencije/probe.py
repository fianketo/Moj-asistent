#!/usr/bin/env python3
import urllib.request, re, json
UA = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) moj-asistent/1.0'}
URLS = ['https://www.uap.gov.rs/', 'https://www.uap.gov.rs/feed/', 'https://www.uap.gov.rs/javni-pozivi/', 'https://www.uap.gov.rs/category/javni-pozivi/',
  'https://www.minpolj.gov.rs/', 'https://www.minpolj.gov.rs/feed/', 'https://www.minpolj.gov.rs/category/vesti/feed/',
  'https://www.psp.vojvodina.gov.rs/', 'https://www.psp.vojvodina.gov.rs/feed/', 'https://www.psp.vojvodina.gov.rs/konkursi/', 'https://www.psp.vojvodina.gov.rs/category/konkursi/',
  'https://www.novisad.rs/konkursi', 'https://www.novisad.rs/oglasi-i-konkursi', 'https://www.agronews.rs/feed/', 'https://www.ipard.gov.rs/', 'https://eagrar.gov.rs/']
out = []
for u in URLS:
    try:
        r = urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=40)
        b = r.read().decode('utf-8', 'replace')
        links = re.findall(r'<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>', b, re.S)
        kw = [(h, re.sub(r'<[^>]+>|\s+', ' ', t).strip()) for h, t in links if re.search(r'poziv|konkurs|позив|конкурс|podstic|подстиц|subvenc', h + t, re.I)]
        out.append(f'=== {u}\nstatus {r.status} {r.headers.get("Content-Type")} len {len(b)}\nTITLE {re.search(r"<title>(.*?)</title>", b, re.S).group(1).strip() if "<title>" in b else ""}\nKW LINKS ({len(kw)}):\n' + '\n'.join(f'  {t[:120]} -> {h}' for h, t in kw[:40]) + ('\nRSS ITEMS:\n' + '\n'.join('  ' + re.sub(r'\s+', ' ', t)[:150] for t in re.findall(r'<item>.*?<title>(.*?)</title>', b, re.S)[:15]) if '<rss' in b[:500] else ''))
    except Exception as e:
        out.append(f'=== {u}\nGREŠKA {e!r}')
open('data/subvencije/probe.txt', 'w').write('\n\n'.join(out)); print('ok')
