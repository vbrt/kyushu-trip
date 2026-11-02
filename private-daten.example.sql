-- Private Reisedaten (Schritt 3 von 3). NICHT ins Repository committen!
-- Kopie als private-daten.sql anlegen, ausfüllen, in Supabase im SQL Editor ausführen, danach löschen.
-- Alle Felder sind optional. Datumsangaben: YYYY-MM-DD. Statusfarben: ok, warn, crit, grey, trail.
insert into public.cockpit_items (coll, id, data) values ('private', 'trip', $trip$
{
  "emails": { "lena@example.com": "lena" },
  "alerts": [ { "title": "Früher Flug am 3.5.", "text": "Um 05:30 los zum Flughafen.", "kind": "warn" } ],
  "days": [
    { "date": "2027-05-03", "title": "Anreise Lissabon", "where": "Düsseldorf → Lissabon",
      "steps": [["07:30", "Abflug DUS"], ["10:00", "Landung LIS, Metro ins Zentrum"]],
      "sleep": "Hotel Beispiel", "tags": [["Flug", "grey"]] }
  ],
  "flights": [
    { "id": "f1", "date": "Mo 3.5.", "from": "DUS", "to": "LIS", "dep": "07:30", "arr": "09:45", "dur": "3 Std. 15 Min.",
      "carrier": "Beispiel Air · XY 123", "status": ["Bestätigt", "ok"], "code": "ABC123", "info": "1 Koffer inklusive" }
  ],
  "stays": [
    { "id": "s1", "when": "3.–9.5. · 6 Nächte", "name": "Hotel Beispiel", "place": "Lissabon", "addr": "Rua Exemplo 1, Lisboa",
      "kv": [["Check-in", "ab 15:00"], ["Buchungsnr.", "123456"]], "status": ["Bestätigt", "ok"], "info": "" }
  ],
  "transfers": [],
  "todos": [
    { "id": "t-versicherung", "t": "Auslandskrankenversicherung prüfen", "sub": "", "due": "2027-04-25", "prio": "warn" }
  ],
  "pack": [ { "cat": "Dokumente", "items": ["Personalausweis", "Kreditkarte", "Versicherungsnachweis"] } ],
  "guides": {
    "lis": { "name": "Lissabon", "intro": "Kurzbeschreibung", "must": [["Alfama", "Altstadt"]], "food": [["Pastéis de Belém", "Das Original"]], "practical": ["Viva-Viagem-Karte für Öffis"] }
  },
  "quick": [ { "what": "Flug", "amount": "", "cur": "EUR", "cat": "Flüge", "date": "2027-05-03" } ],
  "money": ["Karte wird fast überall akzeptiert."],
  "emergency": [["Deutsche Botschaft Lissabon", "Telefon vor Abreise prüfen"]],
  "facts": [["Ausweis", "Gültig bis …"]]
}
$trip$::jsonb)
on conflict (coll, id) do update set data = excluded.data;
