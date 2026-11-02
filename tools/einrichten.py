#!/usr/bin/env python3
"""Verbindet die Vorlage mit einem Supabase-Projekt.
Aufruf: python3 tools/einrichten.py https://abcd1234.supabase.co ANON_KEY https://name.github.io/repo/
Schreibt config.js und trägt den Supabase-Host in die Content-Security-Policy beider Seiten ein."""
import sys, re, pathlib
if len(sys.argv) != 4:
    sys.exit(__doc__)
url, key, site = sys.argv[1].rstrip("/"), sys.argv[2], sys.argv[3]
if not re.fullmatch(r"https://[a-z0-9]+\.supabase\.co", url):
    sys.exit("Supabase-URL sieht falsch aus: " + url)
if not site.endswith("/"):
    site += "/"
host = url.split("//", 1)[1]
root = pathlib.Path(__file__).resolve().parent.parent
(root / "config.js").write_text(f'''// Supabase-Verbindung dieser Reise. Der anon-Key ist öffentlich; die Rechte regelt die Datenbank.
window.APP_CONFIG = {{
  supabaseUrl: "{url}",
  supabaseAnonKey: "{key}",
  siteUrl: "{site}"
}};
''', encoding="utf-8")
for page in ["index.html", "cockpit.html"]:
    p = root / page
    s = p.read_text(encoding="utf-8")
    s = re.sub(r"https://(SUPABASE_HOST|[a-z0-9]+\.supabase\.co)", "https://" + host, s)
    s = re.sub(r"wss://(SUPABASE_HOST|[a-z0-9]+\.supabase\.co)", "wss://" + host, s)
    p.write_text(s, encoding="utf-8")
print("Fertig: config.js geschrieben, CSP auf", host, "gesetzt.")
