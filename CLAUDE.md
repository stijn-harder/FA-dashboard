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
- `index.html`: de hele app (HTML, CSS, JS in één bestand). Menu: Overzicht (met funneltrechter en onderaan trends per maand), Marketing (Leads & bronnen, Kosten & rendement, Socials), Sales (Intakes, Bruto marge, Offertes & pijplijn), Projecten (doorlooptijd, tijd per fase, orderwaarde), Financieel (alleen admins, opnieuw pincode, vergrendelt na 30 min), Targets.
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
- `data/targets/maanden`: targets per maand. `fa_offertes` = target offerteaanvragen (leeg = 25).
- `kpi_maand` (id `YYYY-MM`, alleen admins): historie uit de maandpresentaties `{leads, leadsT, intakes, intakesT, voortrajecten, voortrajectenT, marge, margeT}`. Trends op Overzicht: waarde uit `kpi_maand` wint, anders rekent de cockpit zelf vanaf `KPI_LIVE_VANAF` (2026-10). Target: maandtarget, anders `kpi_maand`. Dec 2025 t/m sep 2026 op 11 nov geïmporteerd uit de presentatie (leads = leads + offerteaanvragen); views idem in `socials` (maart ontbreekt).
- `socials` (id `YYYY-MM`, elk teamlid): `{views, viewsTarget, kanalen:{instagram,tiktok,youtube,facebook:{views, volgers, totaal}}, viewsTotaal}`. Totaal views = `viewsTotaal` (uit rapport) als die er is, anders som van de kanalen. `volgers` = nieuwe volgers in die maand, `totaal` = totaal aantal volgers. Lege waarden blijven null (gat in de grafiek). Jan t/m aug 2026 op 11 nov geïmporteerd uit de rapporten van Van de Socials. Optioneel `top:{instagram:[{titel, geplaatst, views, likes, reacties, reposts, gedeeld}]}` en `topNoot`: top-video's per kanaal, getoond als lijst met engagement. Werkwijze: Jeroen zet de screenshots van Colin (afgelopen 30 dagen) in een Claude-sessie, Claude leest ze uit en schrijft ze hier weg. Pagina Socials wordt later uitgebreid met Colin.
- `kosten`: marketingkosten `{maand: 'YYYY-MM', bron, bedrag, omschrijving}`. Handmatig (id `hand-…`, alleen admins) of later uit Exact via `ingest` (id moet beginnen met `exact-`).
- `financieel`: alleen admins. id's: `cashflow-YYYY-MM-DD` `{datum, bank, ohw, deb, cred, mk}` (beschikbaar = bank + onderhanden werk + deb − cred − 2× mk); `werkelijk-YYYY-MM`, `begroting-50k-YYYY-MM`, `begroting-100k-YYYY-MM` met `{soort, maand, regels:{omzet, kostprijs, uitbesteed, lonen, sociaal, afschr, personeel, kantoor, verkoop, auto, algemeen, rente}}`; `werkelijk` kan in `regels` ook de omzet-uitsplitsing hebben: `omzetOntwerp`, `omzetZonder`, `omzetVoor`, `omzetOverig` (samen = `omzet`; regel Netto-omzet klapt uit). `werkelijk` heeft ook `toelichting` (vrije tekst per maand, los invulveld onder de cijfers) en `toelichtingDoor`. Begroting 2026 en gerealiseerd jan t/m okt 2026 zijn op 9 en 11 nov uit Excel geïmporteerd. Pagina-opbouw: headline (gerealiseerd t/m laatste maand + 'wat we nog moeten' per begroting), dan cijfers per maand/YTD (uitklapbaar), dan cashflow, dan invullen. Dekking = realisatieforecast lopend jaar (gewogen, Odoo) + orderportefeuille (totaal, alle jaren), gedeeld door nog benodigde bruto marge. Volgens Jeroen is de Odoo-forecast bruto marge. Nu handmatig; later bank/deb/cred en `werkelijk` uit Exact (dan `ingest` uitbreiden voor deze collectie).
- `leads` bevat ook `bron` (UTM-bron), `medium` en `leadbron` uit Odoo; `ingest` kan met `patch` alleen die velden bijwerken.
- `projecten` (id `alle`, alleen via `ingest`): `{bijgewerkt, fases:[{k,naam}], projecten:[{id, naam, klant, soort (Design/Project), fase, afgerond, start, done, totaal, fases:{k:{datum, dagen, lopend}}, order:{nr, bedrag, datum}}]}`. Elk uur door n8n-workflow `hkP3O00J088b3mp9` "Projecten cockpit" (Jeroen, schrijft met `ingest_secret_leadcontrole`, dat mag `leads` en `projecten`). Bron: Odoo project.project met Studio-velden 'Datum <fase>' en 'Datum Done'. Doorlooptijd = kick-off (anders aanmaak) tot Done; tijd per fase = chronologisch tot de volgende latere fasedatum; laatste fase van een lopend project = lopend. Soort uit de naam (Design/Floorplanner = Design; Realisatie of 'Project:' = Project; anders Project als het ooit in fase 4/5/6 zat). Weggelaten: transport, levering apparatuur, consultancy, sjablonen, tests. Orderwaarde = `amount_untaxed` van de verkooporder (omzet, geen marge). Pagina Projecten (menu Projecten, hele team).
- `leads.verrijking` (sinds 18 nov, door de leadcontrole van Jeroen, elk uur, alle leads vanaf 1 jan): `{campagne, content (video), term, fase, status (open/gewonnen/verloren; gearchiveerd = verloren), bedrag (expected_revenue = bruto marge), gewonnenOp}`, plus bij vervolgkansen `{vervolgAantal, vervolgStatus, vervolgBedrag, vervolgGewonnenOp, vervolgNaam}`. Vervolgkansen ('voortkomend uit') lopen terug naar de oorspronkelijke lead; bij een kring telt de oudste (laagste id). Staat een vervolgkans zelf als lead in `leads`, dan heeft die `vervolgVan` en telt hij niet mee in 'Wat levert het op'. Getoond op Leads & bronnen: tabel bron → campagne → video (week/maand/jaar), leads die in de periode binnenkwamen en hun uitkomst; 'Overig / geen bron' = geen bron of minder dan 3 leads.

## Bronlogica
- **Type van een lead (vaste regel sinds 16 nov):** bepaald uit de formuliertekst in Odoo (`description`), niet uit de naam of de UTM-bron. "Type ruimte: Website E-book …" = E-book; "Type ruimte: …" + "Dienst: …" = Offerteaanvraag; geen formuliertekst = Overige aanvraag. Bij een samengevoegde lead staan meerdere formulierteksten; het eerste blok (van de oudste, eigen lead) telt. Kansen met "voortkomend uit" gevuld tellen niet als nieuwe lead. **Eén persoon, één lead:** vraagt iemand een e-book én een offerte aan, dan telt alleen de offerteaanvraag. E-books of overige leads die in Odoo in een andere lead zijn opgegaan tellen niet. Zo'n lead krijgt in `docs` `telt:false` + `nietMeetellen` (reden) en wordt door de cockpit overal weggelaten; een offerteaanvraag wordt nooit uitgesloten. (Meta-advertentie "adviesgesprek" leidt naar het offerteformulier; die leads kwamen eerder ten onrechte als e-book binnen.)
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
- **Offerteaanvragen gaan verloren door hernoemen en samenvoegen (uitgezocht 11 nov).** De workflow bepaalt het type uit de leadnaam ("Sportschool - …" = offerteaanvraag). Dat gaat mis als sales de lead hernoemt ("Voortraject: …") vóór de import, of een nieuwe aanvraag samenvoegt met een oudere lead (de nieuwe lead verdwijnt dan). In okt/nov 5 gevallen, op 11 nov hersteld in `docs` (veld `herstelNoot`). Gewenst in de workflow: type bepalen uit de formuliertekst in `description` ("Type ruimte: … Dienst: …"; "Type ruimte: Website E-book" = e-book) en Odoo-berichten "De lead/verkoopkans samengevoegd: … Aangemaakt op: …" uitlezen, zodat een opgeslokte aanvraag alsnog telt.
- Odoo-automatisering 37 (serveractie 1404, dubbele lead binnen 15 min archiveren) is op 11 nov aangepast: archiveert alleen nog bij hetzelfde soort aanvraag. E-book plus offerte van dezelfde persoon blijven allebei staan, met een notitie.
- **Leadcontrole (n8n van Jeroen, workflow `X58oHbOF0fjCU8fc`, elk uur op :20, actief sinds 16 nov):** past de typeregel toe op leads van deze en vorige maand en voegt in Odoo samengevoegde offerteaanvragen toe (id `odoo-merge-<berichtid>`). Gebruikt een eigen wachtwoord `ingest_secret_leadcontrole` (private.settings) dat via `ingest` alleen `leads` mag schrijven, plus `rpc/ingest_leads_lezen` om dubbels te voorkomen. Zolang Stijns workflow nog op naam/bron typeert, corrigeert deze controle het binnen het uur.
