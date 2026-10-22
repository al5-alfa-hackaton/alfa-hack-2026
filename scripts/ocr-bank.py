#!/usr/bin/env python3
"""Optional offline OCR. Requires tesseract with rus+eng language data; no LLM calls."""
import concurrent.futures
import datetime
import json
import os
import pathlib
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[1] / "data" / "processed"

def recognize(doc):
    target = ROOT / "bank-ocr" / (doc["id"] + ".json")
    if target.exists():
        return
    pages = []
    for number in range(1, len(doc["pages"]) + 1):
        image = ROOT / "bank-pages" / doc["id"] / ("p%02d.png" % number)
        if not image.exists():
            raise RuntimeError("Missing page image: " + str(image))
        result = subprocess.run(
            ["tesseract", str(image), "stdout", "-l", "rus+eng"],
            capture_output=True, text=True, check=True, timeout=120,
            env={**os.environ, "OMP_THREAD_LIMIT": "1"},
        )
        pages.append(result.stdout)
    output = {
        "documentId": doc["id"], "file": doc["file"], "model": "tesseract-rus+eng",
        "createdAt": datetime.datetime.now(datetime.timezone.utc).isoformat(), "pages": pages,
    }
    target.parent.mkdir(parents=True, exist_ok=True)
    temp = target.with_suffix(".part")
    temp.write_text(json.dumps(output, ensure_ascii=False))
    temp.replace(target)
    print(doc["id"] + ": " + str(len(pages)) + " pages", flush=True)

if __name__ == "__main__":
    corpus = json.loads((ROOT / "bank-chunks.json").read_text())
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(recognize, corpus["documents"]))
