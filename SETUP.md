# Reise-App Vorlage: Cockpit + Blog

Eine Web-App pro Reise:
- **Blog** (`index.html`): öffentlich, für Familie & Freunde. Reaktionen und Kommentare ohne Account, Live-Wetter, „Wo bin ich gerade?“.
- **Cockpit** (`cockpit.html`): privat nach Login. Tagesplan, Buchungen mit Beleg-Upload, Orte & Tipps, Posten (mit Sparmodus und Offline-Warteschlange), Kosten-Abrechnung für beliebig viele Mitreisende, To-dos, Packliste, Notfall, Wunschliste.
- Läuft offline, lässt sich als App auf den Homescreen legen.

**Wichtig: Jede Reise bekommt ein eigenes GitHub-Repository und ein eigenes Supabase-Projekt.** So können sich Daten, Logins und Fotos verschiedener Reisen nie vermischen.

## Was wo hinkommt
| Datei | Inhalt | Öffentlich? |
|---|---|---|
| `trip.js` | Titel, Daten, Personen, Stationen, Orte für den Blog, Wetter-Orte, Funktionen an/aus | **ja**, nichts Privates eintragen |
| `img/` | Titelbilder, Personenfotos, App-Icons | ja |
| `private-daten.sql` (aus `private-daten.example.sql`) | Tagesplan, Buchungen mit Codes/Adressen, To-dos, Packliste, Orts-Tipps, Notfall, E-Mail-Zuordnung | **nein**, nur in Supabase ausführen, nie committen |
| `config.js` | Supabase-URL + anon-Key + Seitenadresse (per `tools/einrichten.py`) | ja (anon-Key ist öffentlich gedacht) |

## Einrichtung einer neuen Reise
1. **GitHub:** Neues öffentliches Repository anlegen und den Inhalt dieser Vorlage hineinkopieren. Unter Settings → Pages: Branch `main`, `/ (root)`.
2. **Supabase:** Neues Projekt (Region Frankfurt). Im SQL Editor nacheinander ausführen:
   1. `schema.sql` (vorher E-Mail-Adressen der Mitreisenden eintragen)
   2. `security.sql`
   3. `cockpit-schema.sql`
   4. `private-daten.sql` (die ausgefüllte private Kopie)
3. **Nutzer anlegen:** Authentication → Users → Add user → Create new user, mit Start-Passwort und **Auto Confirm User**. Für jede Person, die in `editors` steht.
4. **Auth-Einstellungen:** Sign-ups ausschalten. Site URL und Redirect URLs (`https://NAME.github.io/REPO/**`) eintragen. Passwort-Mindestlänge auf 10 setzen.
5. **Verbinden:** `python3 tools/einrichten.py https://XYZ.supabase.co ANON_KEY https://NAME.github.io/REPO/`, dann committen.
6. **Prüfen:** `check.sql` in Supabase ausführen, alles sollte ✅ zeigen.
7. **Homescreen:** In Safari ••• → Teilen → Zum Home-Bildschirm.

## Anpassen
- Personen: `trip.js → people` (key = Kleinbuchstaben). Die gleichen Keys nutzen `emails` in den privaten Daten und die Kosten-Abrechnung.
- Funktionen: `trip.js → features` (`blog`, `costs`, `wishes`).
- Währungen: `trip.js → baseCurrency`, `currencies`.
- Farben: `style.css` und der Style-Block in `cockpit.html` (`--accent`, `--trail`).
- Icons: `img/icon-*.png`, `img/apple-touch-icon.png`.
