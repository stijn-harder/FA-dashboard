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
- `index.html`: de hele app (HTML, CSS, JS in één bestand). Menu: Overzicht (met funneltrechter en onderaan trends per maand), Marketing (Leads & bronnen, Kosten & rendement, Socials), Sales (Intakes, Bruto marge, Offertes & pijplijn), Financieel (alleen admins, opnieuw pincode, vergrendelt na 30 min), Targets.
- `adapter.js`: Supabase-client, pincode-login, en een `db`-laag (collection/doc/onSnapshot/set/delete) bovenop tabel `docs`.
- Supabase-project `fa-cockpit` (id `xcouykrxuihszhleobcw`, eu-central-1).
  - `public.docs(collection, id, data jsonb, updated_at, updated_by)`, realtime aan.
  - `public.team(user_id, naam, rol, admin)`. Admins: Stijn, Sil, Timo, Jeroen.
  - RLS: lezen alleen teamleden. `odoo` en `odoo_trend` alleen via de functie `ingest` (n8n). `data/targets/*`, `orderportefeuille`, `kosten`, `kpi_maand` schrijven alleen admins. `financieel` lezen én schrijven alleen admins. `profielen` alleen je eigen rij.
  - Inloggen: e-mail `<naam>@cockpit.fitnessaannemer.nl`, wachtwoord is `fa-pin-` + pincode.
- n8n-workflow "Ochtendcijfers Odoo (alleen lezen)" (id `f2rSCItEQepF0UfK`), elk half uur:
  Odoo (leads, offertes, open verkoopkansen, activiteiten) → berekenen → `Cockpit-pakket` → POST `rpc/ingest`.
  Na een wijziging in n8n altijd opnieuw publiceren, anders draait de oude versie.

## Collecties in `docs`
- `intakes`, `marge`, `leads`: invoer door het team.
- `odoo` (id = datum): dagoverzicht uit Odoo, incl. `forecast.verkoop` en `forecast.realisatie` per jaar (2026, 2027) en `forecast.zonderDatum`.
- `odoo_trend` (id = datum): dagstand. In de app per ISO-week getoond (laatste stand van de week).
  Velden: `offerteportefeuille`, `fc2026Ong/Gew`, `fc2027Ong/Gew` (verkoop), `rl2026Ong/Gew`, `rl2027Ong/Gew` (realisatie).
- `orderportefeuille` (id = datum): handmatige weekstand door admins: `{datum, bedrag, notitie, door}`. Plus id `target` (zonder `datum`): `{target, deadline, startdatum, door}`. Schema = rechte lijn van de stand op `startdatum` naar `target` op `deadline`; getoond op Targets en bij de orderportefeuille op Offertes & pijplijn.
- `data/targets/maanden`: targets per maand.
- `kpi_maand` (id `YYYY-MM`, alleen admins): historie uit de maandpresentaties `{leads, leadsT, intakes, intakesT, voortrajecten, voortrajectenT, marge, margeT}`. Trends op Overzicht: waarde uit `kpi_maand` wint, anders rekent de cockpit zelf vanaf `KPI_LIVE_VANAF` (2026-10). Target: maandtarget, anders `kpi_maand`. Dec 2025 t/m sep 2026 op 11 nov geïmporteerd uit de presentatie (leads = leads + offerteaanvragen); views idem in `socials` (maart ontbreekt).
- `socials` (id `YYYY-MM`, elk teamlid): `{views, viewsTarget, door}`, alle kanalen samen, handmatig. Pagina Socials wordt later uitgebreid met Colin.
- `kosten`: marketingkosten `{maand: 'YYYY-MM', bron, bedrag, omschrijving}`. Handmatig (id `hand-…`, alleen admins) of later uit Exact via `ingest` (id moet beginnen met `exact-`).
- `financieel`: alleen admins. id's: `cashflow-YYYY-MM-DD` `{datum, bank, ohw, deb, cred, mk}` (beschikbaar = bank + onderhanden werk + deb − cred − 2× mk); `werkelijk-YYYY-MM`, `begroting-50k-YYYY-MM`, `begroting-100k-YYYY-MM` met `{soort, maand, regels:{omzet, kostprijs, uitbesteed, lonen, sociaal, afschr, personeel, kantoor, verkoop, auto, algemeen, rente}}`; `werkelijk` kan in `regels` ook de omzet-uitsplitsing hebben: `omzetOntwerp`, `omzetZonder`, `omzetVoor`, `omzetOverig` (samen = `omzet`; regel Netto-omzet klapt uit). `werkelijk` heeft ook `toelichting` (vrije tekst per maand, los invulveld onder de cijfers) en `toelichtingDoor`. Begroting 2026 en gerealiseerd jan t/m okt 2026 zijn op 9 en 11 nov uit Excel geïmporteerd. Nu handmatig; later bank/deb/cred en `werkelijk` uit Exact (dan `ingest` uitbreiden voor deze collectie).
- `leads` bevat ook `bron` (UTM-bron), `medium` en `leadbron` uit Odoo; `ingest` kan met `patch` alleen die velden bijwerken.

## Bronlogica
- Bron van een lead: UTM-bron + medium (Meta ads, Google organisch, Instagram organisch …); zonder UTM de Leadbron uit Odoo.
- Bron van een intake: het gekozen veld; bij leeg/Website/E-book de lead met dezelfde naam. Deals koppelen via klantnaam aan de intake.
- "Verst achter" = bron met de meeste gemiste intakes t.o.v. de gemiddelde lead→intake-conversie (min. 5 leads).

## Forecastregels
- Alleen open kansen in Lead, Inventarisatie, Follow-up, Offerte, Getekend onder voorbehoud.
- Alleen kansen met zowel `date_deadline` (sluitingsdatum) als `x_studio_opleverdatum`.
- Verkoop = jaar van sluitingsdatum, realisatie = jaar van opleverdatum. Datums vóór 2026 tellen als verlopen in 2026.
- Gewogen = `expected_revenue` × `probability` / 100.

## Testen
Geen buildstap. Lokaal openen kan, maar de Supabase-verbinding werkt alleen live. Controleer na een push de live pagina.

## Open punten
- **Leads missen na een gemiste run (voor Stijn, n8n `f2rSCItEQepF0UfK`).** Op 5 nov zijn 5 Odoo-leads (7337, 7338, 7340, 7341, 7342, aangemaakt 07:50 tot 11:04) nooit in `leads` gekomen. In Odoo verschillen ze nergens van leads die wel binnenkwamen; alleen het tijdstip. De workflow haalt kennelijk alleen nieuwe leads sinds de vorige run op, dus een gemiste run is blijvend. Gewenst: elke run alle leads van de lopende (en vorige) maand ophalen en via `ingest` met `patch` bijwerken, zodat het zichzelf herstelt. Regels blijven: 'voortkomend uit' gevuld = geen nieuwe lead. Leadbron staat in Odoo in `lead_properties` (eigenschap "Leadbron"); waarden trimmen ("E-mail " → "E-mail").
- De 5 leads zijn op 8 nov door Jeroen handmatig toegevoegd in `docs` (zelfde formaat, type "Overige aanvraag", kanaal = leadbron). Na de fix kan de workflow ze gewoon overschrijven.
- **Samengevoegde of verwijderde Odoo-leads blijven staan (voor Stijn).** Odoo-lead 7336 (Farlyn, offerteaanvraag) is samengevoegd met 7335 en bestaat niet meer, maar bleef in `leads` staan en telde dubbel. Op 8 nov handmatig verwijderd. Gewenst: de workflow ruimt `leads` met een `odoo-`id op die niet meer in Odoo bestaan (actief of gearchiveerd). Kan niet via `ingest` (die verwijdert niets), dus `ingest` uitbreiden of een aparte opschoonstap.
