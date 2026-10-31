"""Pravi www/zones-ns.json iz katastra (PDF) Parking servisa Novi Sad.
Ulaz: shapes.json, codes.json (izvučeno iz katastar.pdf), transform2.json (poravnanje PDF→OSM),
zone-streets.json (zvanični spiskovi ulica po zonama sa šiframa)."""
import json, math, numpy as np
LAT0, LNG0 = 45.25, 19.84
KX = math.cos(math.radians(LAT0))*111320; KY = 110574
T=json.load(open('transform2.json')); s=T['s']; R=np.array(T['R']); t=np.array(T['t'])
def ll(x,y):
    m=s*(R@np.array([x,-y]))+t
    return (LAT0+m[1]/KY, LNG0+m[0]/KX)
shapes=json.load(open('shapes.json')); codes=json.load(open('codes.json'))
streets=json.load(open('zone-streets.json'))
code_info={}
for e in streets:
    for c in e['codes']: code_info[c]={'zone':e['zone'],'text':e['text']}
ZONES=['ekstra','crvena','plava','bela']
code_list=sorted({c for c in code_info}, key=lambda c:int(c))
cidx={c:i for i,c in enumerate(code_list)}
C=np.array([[c['x'],c['y']] for c in codes]); Ccode=[c['code'].strip('()') for c in codes]
grid={}
for sh in shapes:
    z=sh['z']; pts=sh['pts']
    cx=sum(p[0] for p in pts)/len(pts); cy=sum(p[1] for p in pts)/len(pts)
    # najbliža šifra iste zone (do 70 pt)
    d=np.hypot(C[:,0]-cx,C[:,1]-cy); best=-1
    for i in np.argsort(d)[:8]:
        if d[i]>70: break
        ci=code_info.get(Ccode[i])
        if ci and ci['zone']==z: best=cidx[Ccode[i]]; break
    # gustina ~6 m duž ivica oblika
    seq=pts+[pts[0]] if len(pts)>2 else pts
    for a,b in zip(seq[:-1],seq[1:]):
        L=math.dist(a,b)*s; n=max(1,int(L/8))
        for k in range(n+1):
            x=a[0]+(b[0]-a[0])*k/n; y=a[1]+(b[1]-a[1])*k/n
            la,ln=ll(x,y)
            key=(round(la*1e5/9),round(ln*1e5/9),z)  # ~5 m mreža
            if key not in grid or (grid[key][3]<0 and best>=0): grid[key]=(la,ln,ZONES.index(z),best)
pts=list(grid.values())
base_lat=min(p[0] for p in pts); base_lng=min(p[1] for p in pts)
flat=[]
for la,ln,zi,ci in sorted(pts):
    flat += [round((la-base_lat)*1e5), round((ln-base_lng)*1e5), zi, ci]
out={'v':1,'source':'JKP Parking servis Novi Sad – Tehnička baza sistema naplate 26.06.2026.',
     'base':[base_lat,base_lng],'scale':1e-5,'zones':ZONES,
     'codes':[[c,code_info[c]['text']] for c in code_list],'pts':flat}
json.dump(out,open('../../www/zones-ns.json','w'),ensure_ascii=False,separators=(',',':'))
import collections
print(len(pts),'tačaka', collections.Counter(ZONES[p[2]] for p in pts), 'sa šifrom %.0f%%'%(100*sum(p[3]>=0 for p in pts)/len(pts)))
