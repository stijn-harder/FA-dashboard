# FA COCKPIT

Het eigen dashboard van Fitness Aannemer: leads, intakes, voortrajecten en bruto marge per maand, met targets, Odoo-cijfers en vieringen.

- **App:** statische pagina (GitHub Pages), inloggen met naam en pincode.
- **Data:** Supabase-project `fa-cockpit` (tabel `docs`), beveiligd met Row Level Security. In deze repo staan geen gegevens of geheime sleutels; de publishable key in `adapter.js` is bedoeld om publiek te zijn.
- **Odoo-cijfers:** n8n zet elk half uur een overzicht in Supabase via de functie `ingest`.

Beheer: Stijn Harder.
