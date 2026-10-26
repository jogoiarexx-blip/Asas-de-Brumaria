#!/usr/bin/env python3
"""Derive 512px CC0 WebP island previews offline from the existing mobile maps."""
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]/'assets/textures/terrain'
KINDS=('meadow','beach','stone','ash','crystal')

def build():
    manifest_path=ROOT/'manifest.json'
    manifest=json.loads(manifest_path.read_text(encoding='utf8'))
    assert manifest['license']=='CC0-1.0'
    variants={}
    for kind in KINDS:
        src=ROOT/f'{kind}_diff_mobile.webp'
        out=ROOT/f'{kind}_diff_low.webp'
        with Image.open(src) as image:
            image=image.convert('RGB').resize((512,512),Image.Resampling.LANCZOS)
            image.save(out,'WEBP',quality=82,method=6)
        raw=out.read_bytes()
        assert len(raw)<140_000 and raw[:4]==b'RIFF' and raw[8:12]==b'WEBP', out
        variants[kind]={'filename':out.name,'size':[512,512],
            'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}
    manifest['distance_lod']={
        'description':'512px distant-island diffuse previews derived from the CC0 mobile maps; original 1024px and 2048px remain unchanged',
        'variants':variants
    }
    manifest_path.write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n',encoding='utf8')
    print('ISLAND_DISTANCE_LOD_GENERATED',sum(x['bytes'] for x in variants.values()))

if __name__=='__main__':build()
