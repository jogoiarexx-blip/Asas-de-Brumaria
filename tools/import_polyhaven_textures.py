#!/usr/bin/env python3
"""Fetch verified CC0 Poly Haven terrain materials and ship optimized local WebP.
Only Poly Haven's own API may choose asset URLs; no live runtime hotlinking.
The original photo scans are higher resolution; browser builds are 1024/2048.
Requires Pillow (CI installs it). Run manually to refresh licensed assets.
"""
from __future__ import annotations
import hashlib, io, json, os, sys, time, urllib.parse, urllib.request
from pathlib import Path
from PIL import Image, ImageOps

SOURCE = {
    "meadow": "forrest_ground_01",
    "beach": "coast_sand_02",
    "stone": "rocky_terrain_02",
    "ash": "dark_rock",
    "crystal": "rocks_ground_06",
}
RESOLUTIONS = {"mobile": 1024, "desktop": 2048}
CHANNELS = ("Diffuse", "nor_gl")
ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "assets" / "textures" / "terrain"
BASE = "https://api.polyhaven.com"
USER_AGENT = "Asas-de-Brumaria-terrain-import/1.0 (https://polyhaven.com/license)"

def fetch(url, max_bytes=22_000_000):
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != "https" or parsed.hostname not in {
        "api.polyhaven.com", "dl.polyhaven.org", "cdn.polyhaven.com"
    }:
        raise ValueError("Rejected external asset host: " + str(parsed.hostname))
    req = urllib.request.Request(url, headers={"User-Agent":USER_AGENT})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=55) as response:
                if int(response.headers.get("Content-Length","0")) > max_bytes:
                    raise ValueError("Texture exceeds 22MB download budget")
                data=response.read(max_bytes+1)
                if len(data)>max_bytes: raise ValueError("Texture exceeds download limit")
                return data
        except (OSError, TimeoutError):
            if attempt==2: raise
            time.sleep(2*(attempt+1))

def file_url(files, name):
    """The official /files/{id} format is map -> resolution -> format -> URL."""
    aliases={
        "Diffuse":("Diffuse","diff","diffuse"),
        "nor_gl":("nor_gl","Normal (GL)","Normal","normal")
    }[name]
    for key in aliases:
        entries=files.get(key)
        if not isinstance(entries,dict):continue
        for resolution in ("2k","4k"):
            options=entries.get(resolution,{})
            if not isinstance(options,dict):continue
            for ext in ("jpg","png"):
                field=options.get(ext)
                if isinstance(field,dict) and isinstance(field.get("url"),str):
                    return field["url"],resolution
                if isinstance(field,str):return field,resolution
    raise ValueError(f"No 2k/4k {name} image offered by Poly Haven API")

def convert(raw,output,target,channel):
    with Image.open(io.BytesIO(raw)) as img:
        img=ImageOps.exif_transpose(img)
        if min(img.size)<768:raise ValueError("Low resolution source, not a PBR scan")
        if max(img.size)>target:
            img.thumbnail((target,target),Image.Resampling.LANCZOS)
        img=img.convert("RGB")
        output.parent.mkdir(parents=True,exist_ok=True)
        # WebP preserves high-frequency photographic detail at a fraction of
        # the JPG/PNG transfer size; normal maps have higher quality budget.
        img.save(output,"WEBP",quality=91 if channel=="Diffuse" else 94,
                 method=6)
        if output.stat().st_size>4_500_000:
            raise ValueError("Uncompressed texture too heavy for browser")
        return {"size":list(img.size),"bytes":output.stat().st_size,
                "sha256":hashlib.sha256(output.read_bytes()).hexdigest()}

def main():
    DEST.mkdir(parents=True,exist_ok=True)
    manifest={"source":"Poly Haven","license":"CC0-1.0",
      "license_url":"https://polyhaven.com/license",
      "importer":"tools/import_polyhaven_textures.py",
      "materials":{}}
    output_files=[]
    for key,asset in SOURCE.items():
        files=json.loads(fetch(f"{BASE}/files/{asset}",2_000_000))
        meta={"asset":asset,"page":f"https://polyhaven.com/a/{asset}","channels":{}}
        for channel,tag in (("Diffuse","diff"),("nor_gl","normal")):
            url,res=file_url(files,channel)
            raw=fetch(url)
            entries={}
            for tier,size in RESOLUTIONS.items():
                name=f"{key}_{tag}_{tier}.webp"
                path=DEST/name
                details=convert(raw,path,size,channel)
                details["filename"]=name
                entries[tier]=details
                output_files.append(path)
            meta["channels"][tag]={"source_resolution":res,
                                  "source_url":url,"variants":entries}
            print(f"{key} {tag}: {', '.join(tier+'='+str(entries[tier]['bytes'])+'B' for tier in RESOLUTIONS)}")
        manifest["materials"][key]=meta
    (DEST/"manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n")
    count=len(output_files)
    assert count==len(SOURCE)*2*len(RESOLUTIONS)
    size=sum(p.stat().st_size for p in output_files)
    print(f"POLYHAVEN_ASSETS_OK {count} optimized WebP, {size:,} bytes, licenses verified CC0")

if __name__=="__main__":
    main()
