#!/usr/bin/env python3
"""Create a local account for actual dataset companies. Never prints its access key."""
import argparse
import csv
import json
import os
import pathlib
import re
import secrets

ROOT = pathlib.Path(__file__).resolve().parents[1]

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--user", default="local-owner")
    parser.add_argument("--companies", nargs="+", required=True)
    args = parser.parse_args()
    if not re.fullmatch(r"[a-z0-9-]{1,80}", args.user):
        parser.error("Use lowercase letters, digits and hyphens for --user")
    with (ROOT / "data/raw/df_Uid_data_hack.csv").open() as source:
        allowed = {r["SYNTHETIC_U"] for r in csv.DictReader(source, delimiter=";") if r["CL_TYPE"] == "CLIENT"}
    if not set(args.companies).issubset(allowed):
        parser.error("All companies must be CLIENT records in the downloaded dataset")
    config = ROOT / "projects/backend/.env"
    text = config.read_text() if config.exists() else (config.parent / ".env.example").read_text()
    def read(name, default=""):
        match = re.search(r"^" + name + r"=(.*)$", text, re.M)
        return match[1].strip().strip("'") if match else default
    accounts = json.loads(read("AUTH_USERS_JSON", "[]"))
    if any(a["id"] == args.user for a in accounts):
        parser.error("Account already exists; rotate its key explicitly in server configuration")
    key_path = ROOT / ".local" / ("access-key-" + args.user + ".txt")
    if key_path.exists():
        parser.error("Access-key file already exists; choose a different user")
    token = secrets.token_urlsafe(36)
    accounts.append({"id": args.user, "token": token, "companyIds": args.companies})
    changes = {
        "AUTH_USERS_JSON": json.dumps(accounts, separators=(",", ":")),
        "DEV_AUTH": "false",
        "DATA_DIR": str(ROOT / "data"),
    }
    if read("AGENT_PROVIDER") not in ["langgraph", "disabled"]:
        changes["AGENT_PROVIDER"] = "disabled"
    for name, value in changes.items():
        line = name + "=" + value
        text = re.sub(r"^" + name + r"=.*$", lambda _: line, text, flags=re.M) if re.search(r"^" + name + "=", text, re.M) else text.rstrip() + "\n" + line + "\n"
    key_path.parent.mkdir(parents=True, exist_ok=True)
    descriptor = os.open(key_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w") as output:
        output.write(token + "\n")
    temp = config.with_suffix(".env.tmp")
    temp.write_text(text)
    temp.chmod(0o600)
    temp.replace(config)
    print("Account configured. Access key: " + str(key_path.relative_to(ROOT)))
    print("Restart backend; enter this key in the browser. It is not stored in Git.")
