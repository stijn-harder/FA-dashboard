# FA COCKPIT: context voor Claude

Lees dit eerst. Stijn en Jeroen bouwen allebei aan dit dashboard, elk in een eigen Claude-sessie. Deze repo is de gedeelde bron.

## Werkafspraken
- Altijd eerst `git pull`, dan bouwen, dan committen en pushen. Kleine commits met een duidelijke Nederlandse omschrijving.
- Elke push naar `main` staat binnen een minuut live op https://stijn-harder.github.io/FA-dashboard/.
- Deze repo is publiek: nooit geheimen, wachtwoorden, pincodes of het ingest-secret in de code of in dit bestand zetten.
- Alles wat geld kost: eerst goedkeuring van Stijn.
- FA stuurt op bruto marge, nooit op omzet. De forecast uit Odoo is verwachte opbrengst (omzet); vermeld dat altijd.
- Teksten: Nederlands, kort, "achter/voor op schema" (nooit "tempo"), geen gedachtestreepjes midden in zinnen.
- Huisstijl: FA blauw #279FDA, navy #0D1B26, font Poppins.

## Architectuur
- `index.html`: de hele app (HTML, CSS, JS in één bestand). Tabs: Overzicht, Leads, Intakes, Bruto marge, Offertes & pijplijn, Targets.
- `adapter.js`: Supabase-client, pincode-login, en een `db`-laag (collection/doc/onSnapshot/set/delete) bovenop tabel `docs`.
- Supabase-project `fa-cockpit` (id `xcouykrxuihszhleobcw`, eu-central-1).
  - `public.docs(collection, id, data jsonb, updated_at, updated_by)`, realtime aan.
  - `public.team(user_id, naam, rol, admin)`. Admins: Stijn, Sil, Timo, Jeroen.
  - RLS: lezen alleen teamleden. `odoo` en `odoo_trend` alleen via de functie `ingest` (n8n). `data/targets/*` en `orderportefeuille` alleen admins. `profielen` alleen je eigen rij.
  - Inloggen: e-mail `<naam>@cockpit.fitnessaannemer.nl`, wachtwoord is `fa-pin-` + pincode.
- n8n-workflow "Ochtendcijfers Odoo (alleen lezen)" (id `f2rSCItEQepF0UfK`), elk half uur:
  Odoo (leads, offertes, open verkoopkansen, activiteiten) → berekenen → `Cockpit-pakket` → POST `rpc/ingest`.
  Na een wijziging in n8n altijd opnieuw publiceren, anders draait de oude versie.

## Collecties in `docs`
- `intakes`, `marge`, `leads`: invoer door het team.
- `odoo` (id = datum): dagoverzicht uit Odoo, incl. `forecast.verkoop` en `forecast.realisatie` per jaar (2026, 2027) en `forecast.zonderDatum`.
- `odoo_trend` (id = datum): dagstand. In de app per ISO-week getoond (laatste stand van de week).
  Velden: `offerteportefeuille`, `fc2026Ong/Gew`, `fc2027Ong/Gew` (verkoop), `rl2026Ong/Gew`, `rl2027Ong/Gew` (realisatie).
- `orderportefeuille` (id = datum): handmatige weekstand door admins: `{datum, bedrag, notitie, door}`.
- `data/targets/maanden`: targets per maand.

## Forecastregels
- Alleen open kansen in Lead, Inventarisatie, Follow-up, Offerte, Getekend onder voorbehoud.
- Alleen kansen met zowel `date_deadline` (sluitingsdatum) als `x_studio_opleverdatum`.
- Verkoop = jaar van sluitingsdatum, realisatie = jaar van opleverdatum. Datums vóór 2026 tellen als verlopen in 2026.
- Gewogen = `expected_revenue` × `probability` / 100.

## Testen
Geen buildstap. Lokaal openen kan, maar de Supabase-verbinding werkt alleen live. Controleer na een push de live pagina.
