import json, re
def load(path='data/usda/sr.json'):
    return json.load(open(path))
def resolve(d, desc):
    by = {v['d']: k for k, v in d.items()}
    if desc in by: return by[desc]
    toks = [t.strip().lower() for t in desc.split(',') if t.strip()]
    c = [(len(v['d']), k) for k, v in d.items() if all(t in v['d'].lower() for t in toks)]
    return min(c)[1] if c else None
