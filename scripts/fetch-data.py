#!/usr/bin/env python3
"""Download the public case datasets linked on pages 15 and 17 of specs/source/brief.pdf."""
import concurrent.futures
import hashlib
import json
import pathlib
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1] / "data" / "raw"
FILES = [
    ("1ZJCiqgY1ma4iQ1_ltabtUuaFIBkrqnOe", "df_Fid_Uid_link_hack.csv", 697194),
    ("12H7sbLwBcpur0fKaGHPqwPwfXfgQq10b", "df_Uid_data_hack.csv", 31414716),
    ("1zkvWkAS0kZqijD-og_0Cv3o01SoUMY_Z", "df_Uid_payment_hack.csv", 38752490),
    ("1yLCBrIoyIsubLTEBvBHh6io48ysnW-wn", "bank/ALFA_Russian_Steels_1К21PreviewUpdate_15Apr2021.pdf", 6968001),
    ("1HZDq3WGRFdzgm1TZ5hWL23Q3I9c2Eq64", "bank/ALFA-7M26.pdf", 6458583),
    ("1riR1lhsb6EY1MwGMxdBlS_tI5ed9mIiz", "bank/ALFA-consumption.pdf", 6658115),
    ("1shHG89LtMgHT1_uEebHmQSFZe_zbeq7-", "bank/ALFA-Macro_Insights-Policy_Rate_11Sep.pdf", 6343186),
    ("1khcHwoS0FkG9p_0J4XoHGaGq3B4V0ime", "bank/ALFA-macro_stat1H26.pdf", 6100459),
    ("1hq3Fhyz9ce_sRyGUQB1MdoHeQdfAJfhK", "bank/FI_Strategy_3Q26_22072026.pdf", 34890230),
    ("1a7TXOCHARfKzUR0hn9Cm9gQSrIldxTDE", "bank/Gold_digest_August26.pdf", 8613150),
    ("19iW3Ph8_wO0HHQY7Ik4lTfC3jRc9gjWV", "bank/Inflation_tracker_02.pdf", 3385668),
    ("1bPzix_332N2CyMY0tqCHuYtGsfJWnFGv", "bank/Бонд_Бриф_14092026.pdf", 7463613),
]

def download(item):
    file_id, name, size = item
    target = ROOT / name
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists() or target.stat().st_size != size:
        temp = target.with_suffix(target.suffix + ".part")
        url = "https://drive.google.com/uc?export=download&id=" + file_id
        with urllib.request.urlopen(url, timeout=60) as response, temp.open("wb") as out:
            if "text/html" in response.headers.get("Content-Type", ""):
                raise RuntimeError("Drive requires browser confirmation: " + name)
            while chunk := response.read(1024 * 1024):
                out.write(chunk)
        if temp.stat().st_size != size:
            temp.unlink()
            raise RuntimeError("Source size changed; review dataset version: " + name)
        temp.replace(target)
    digest = hashlib.sha256(target.read_bytes()).hexdigest()
    print(name + " OK", flush=True)
    return {"file": name, "driveId": file_id, "bytes": size, "sha256": digest}

if __name__ == "__main__":
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        manifest = list(pool.map(download, FILES))
    (ROOT / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
