#!/usr/bin/env python3
"""Praćenje subvencija i podsticaja za poljoprivrednike → subvencije.json (pamti šta je već viđeno)."""
import urllib.request, urllib.parse, re, json, sys, html, hashlib, datetime as D, email.utils
UA = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) moj-asistent/1.0'}
PREV = 'https://raw.githubusercontent.com/%s/subvencije-data/subvencije.json'
def get(u, t=40):
    return urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=t).read().decode('utf-8', 'replace')
CYR = dict(zip('абвгдђежзијклљмнњопрстћуфхцчџшАБВГДЂЕЖЗИЈКЛЉМНЊОПРСТЋУФХЦЧЏШ',
  'a b v g d đ e ž z i j k l lj m n nj o p r s t ć u f h c č dž š A B V G D Đ E Ž Z I J K L Lj M N Nj O P R S T Ć U F H C Č Dž Š'.split()))
lat = lambda s: ''.join(CYR.get(c, c) for c in s)
def clean(s): return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', s or ''))).strip()
MON = {'januar': 1, 'februar': 2, 'mart': 3, 'april': 4, 'maj': 5, 'jun': 6, 'jul': 7, 'avgust': 8, 'septembar': 9, 'oktobar': 10, 'novembar': 11, 'decembar': 12,
       'januara': 1, 'februara': 2, 'marta': 3, 'aprila': 4, 'maja': 5, 'juna': 6, 'jula': 7, 'avgusta': 8, 'septembra': 9, 'oktobra': 10, 'novembra': 11, 'decembra': 12,
       'januarom': 1, 'februarom': 2, 'martom': 3, 'aprilom': 4, 'majem': 5, 'junom': 6, 'julom': 7, 'avgustom': 8, 'septembrom': 9, 'oktobrom': 10, 'novembrom': 11, 'decembrom': 12}
today = D.date.today()
def deadline(text):
    t = lat(text).lower()
    best = None
    for m in re.finditer(r'(?:do|zaključno sa|zakljucno sa|najkasnije do|rok[^.]{0,60}?)\s*(\d{1,2})\.\s*(?:(\d{1,2})\.|([a-zčćžšđ]+))\s*(\d{4})?', t):
        d = int(m.group(1)); mo = int(m.group(2)) if m.group(2) else MON.get(m.group(3) or '')
        if not mo: continue
        y = int(m.group(4)) if m.group(4) else today.year
        try: dt = D.date(y, mo, d)
        except ValueError: continue
        if (today - dt).days > 400 or (dt - today).days > 400: continue
        best = max(best, dt) if best else dt
    return best.isoformat() if best else None
KIND = [('rezultat', r'rang.?list|rezultat|odluk[ae] o dodeli'), ('isplata', r'isplat|rešenj|resenj|na račun|uplat'),
        ('poziv', r'raspisan|javni poziv|konkurs|otvoren|prijav|podnošenj|podnosenj|zahtev')]
TAGS = {'Stočarstvo': r'stoč|stoc|tov|grla|krav|mlek|svinj|ovac|ovc|koz|jagnj|telad|junad|živin|zivin', 'Pčelarstvo': r'pčel|pcel|košnic|kosnic',
        'Biljna proizvodnja': r'biljn|hektar|seme|sadn|voć|voc|povrt|vinogr|plastenik|zaštićen|zasticen|setv|ratar', 'Mehanizacija i oprema': r'mehaniz|mašin|masin|traktor|oprem|priključ',
        'Navodnjavanje': r'navodnj|bunar|irigac', 'IPARD': r'ipard', 'Krediti': r'kredit', 'Ruralni razvoj': r'ruraln|infrastrukt|turiz|selo|sela',
        'Organska proizvodnja': r'organsk', 'Mladi poljoprivrednici': r'mlad[ih]+ poljopr|mladi '}
NOISE = r'anketa|evaluac|edukac|sajam|izložb|cene stoke|startap|takmičen'
def item(src, title, url, date, text):
    t = lat(clean(title)); body = lat(clean(text)); low = (t + ' ' + body[:600]).lower()
    kind = next((k for k, rx in KIND if re.search(rx, t.lower())), 'vest')
    return {'id': hashlib.sha1(url.encode()).hexdigest()[:12], 'src': src, 'title': t, 'url': url, 'date': date,
            'kind': kind, 'tags': [k for k, rx in TAGS.items() if re.search(rx, low)], 'deadline': deadline(body) if kind == 'poziv' else None,
            'summary': body[:320] + ('…' if len(body) > 320 else '')}
def rss(url):
    x = get(url)
    for it in re.findall(r'<item>(.*?)</item>', x, re.S):
        g = lambda tag: (re.search(rf'<{tag}[^>]*>(.*?)</{tag}>', it, re.S) or [None, ''])[1].replace('<![CDATA[', '').replace(']]>', '')
        pd = g('pubDate'); dt = email.utils.parsedate_to_datetime(pd).date().isoformat() if pd else today.isoformat()
        yield g('title'), g('link').strip(), dt, g('content:encoded') or g('description'), g('source')

items, report = [], []
# 1) Uprava za agrarna plaćanja (zvanično)
try:
    n = 0
    for t, l, d, body, _ in rss('https://www.uap.gov.rs/feed/'):
        it = item('Uprava za agrarna plaćanja', t, l, d, body)
        if not re.search(NOISE, it['title'].lower()): items.append(it); n += 1
    report.append(f'UAP: {n}')
except Exception as e: report.append(f'UAP GREŠKA {e!r}')
# 2) Agronews – samo vesti o konkursima, pozivima i podsticajima
try:
    n = 0
    for t, l, d, body, _ in rss('https://www.agronews.rs/feed/'):
        if re.search(r'konkurs|javni poziv|podstic|subvenc|bespovrat|rok za|prijav', lat(t).lower()) and not re.search(NOISE, lat(t).lower()):
            items.append(item('Agronews', t, l, d, body)); n += 1
    report.append(f'Agronews: {n}')
except Exception as e: report.append(f'Agronews GREŠKA {e!r}')
# 3) Google News – Pokrajina Vojvodina i Grad Novi Sad (njihovi sajtovi nisu dostupni za automatsko čitanje)
for q in ['"Pokrajinski sekretarijat za poljoprivredu" konkurs', 'konkurs poljoprivreda Vojvodina bespovratna sredstva', 'Grad Novi Sad konkurs poljoprivreda subvencije']:
    try:
        n = 0
        for t, l, d, body, srcname in rss('https://news.google.com/rss/search?' + urllib.parse.urlencode({'q': q + ' when:60d', 'hl': 'sr-Latn', 'gl': 'RS', 'ceid': 'RS:sr-Latn'})):
            if (today - D.date.fromisoformat(d)).days > 60: continue
            title = re.sub(r'\s+-\s+[^-]+$', '', clean(t))
            if not re.search(r'konkurs|javni poziv|podstic|subvenc|bespovrat|sredstv', lat(title).lower()): continue
            it = item(lat(clean(srcname)) or 'Vesti', title, l, d, title); it['via'] = 'Google News'; items.append(it); n += 1
        report.append(f'Google News „{q}“: {n}')
    except Exception as e: report.append(f'Google News GREŠKA {e!r}')

# spoji sa prethodnim (pamti prvo viđenje, čuva 180 dana)
prev = {}
try: prev = {x['id']: x for x in json.loads(get(PREV % sys.argv[2], 30))['items']}
except Exception as e: report.append(f'(nema prethodnog fajla: {e!r})')
seen_titles, out = set(), []
for it in items + list(prev.values()):
    key = re.sub(r'[^a-z0-9]', '', it['title'].lower())[:70]
    if it['id'] in {x['id'] for x in out} or key in seen_titles: continue
    seen_titles.add(key)
    it['first_seen'] = prev.get(it['id'], {}).get('first_seen') or it.get('first_seen') or D.datetime.utcnow().strftime('%Y-%m-%dT%H:%MZ')
    if (today - D.date.fromisoformat(it['date'])).days <= 180: out.append(it)
out.sort(key=lambda x: (x['date'], x['first_seen']), reverse=True)
json.dump({'updated': D.datetime.utcnow().strftime('%Y-%m-%dT%H:%MZ'), 'items': out[:200],
           'src': 'Uprava za agrarna plaćanja (uap.gov.rs), Agronews, Google News (Pokrajinski sekretarijat za poljoprivredu, Grad Novi Sad)'},
          open(sys.argv[1], 'w'), ensure_ascii=False, separators=(',', ':'))
print('\n'.join(report)); print('ukupno:', len(out), 'poziva:', sum(1 for x in out if x['kind'] == 'poziv'))
for x in out[:15]: print(f"  {x['date']} [{x['kind']}] {x['title'][:90]} | rok {x['deadline']} | {x['tags']} | {x['src']}")
