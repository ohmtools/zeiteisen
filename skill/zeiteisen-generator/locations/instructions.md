You are extracting TH Nürnberg building codes into `schema.json`.

The timetables reference rooms as `<building>.<room>` (e.g. `WE.105`,
`KA.340`, `BB.103`). This task produces one entry per **building code**
(`WE`, `KA`, `BB`, …) so the app can link a room to its building.

The page layout and its content may change. The rules below describe what to
look for, not fixed positions. If a page no longer contains recognisable
building codes and addresses, ask the user (see SKILL.md).

## 1. Collect the site pages

- Start page: the link the user gave. If they gave none, use
  `https://www.th-nuernberg.de/wie-erreichen-sie-uns/anfahrt/`. An English
  directions page works the same way.
- The start page lists the campus sites, e.g. `B: Standort Bahnhofstraße`,
  `K: Standort Keßlerplatz`, `W: Standort Wassertorstraße`, each linking to a
  site page. Fetch **every** site page linked from this list. Ignore the
  site-wide navigation menus. Only fetch URLs that actually appear on the
  page; don't construct them.

Fetching notes (observed in 2026): `web_fetch` refuses URLs that have not
appeared in this conversation, including the default start page above, so
run a `web_search` like `TH Nürnberg Anfahrt Standorte` first and fetch the
start page from the results. Every th-nuernberg.de page carries ~10k tokens
of navigation menus before the content; the site-specific part (address,
"Gebäude: ...", per-address tabs) is near the end. In 2026 there were 12 site
pages with 33 building codes; sites get added and removed, so always take
the current list from the start page. The
sandbox's bash has no network access to th-nuernberg.de, so `curl` won't
work.

## 2. Read each site page

A site page names its buildings and their street addresses, e.g.

```
Wassertorstraße - 90489 Nürnberg
…
Wassertorstraße 10 - Gebäude: WA, WB, WD, WE, WG
### Wassertorstraße 10, 90489 Nürnberg
```

Create one entry per building code:

- `code`: the building code exactly as written, e.g. `"WE"`.
- `name`: the street and house number of that building only, without postal
  code and city, exactly as written on the page: `"Wassertorstraße 10"`,
  `"Bahnhofstraße 90"`, `"Innere Cramer-Klett-Straße 4-8"`.
- `mapsUrl`: a Google Maps search URL for that building's full address
  (street, house number, postal code, city), percent-encoded:

  ```python
  from urllib.parse import quote_plus
  maps_url = "https://www.google.com/maps/search/?api=1&query=" + quote_plus("Wassertorstraße 10, 90489 Nürnberg")
  # -> https://www.google.com/maps/search/?api=1&query=Wassertorstra%C3%9Fe+10%2C+90489+N%C3%BCrnberg
  ```

  Do not use the site-level "Google Maps" link from the page.
- `siteUrl`: the URL of the site page on which you found this building.

Buildings sharing an address get identical `name` and `mapsUrl` values; that
is expected.

Already decided, don't ask:

- A site page that names **no** building codes at all: create one entry for
  the site itself, with the site's code from the start page list (e.g. `CT`
  from `CT: Standort Kronach`), the site's street address as `name`, and the
  URL of that page as `siteUrl`.
- Locations without any code, such as the additional exam venues
  ("Prüfungsstandort Wilhelm-Löhe-Schule", "Mensa Insel Schütt"), are skipped.
- One entry per code. If the same code appears twice with the same address,
  keep it once.

If the page mentions a building in several places (a summary list, an image
caption, per-address sections), use the per-address sections; captions can
contain typos (e.g. "Wollentortraße").

Ask the user (see SKILL.md) when:

- a building code appears with two different addresses anywhere on the page.
  Never pick one yourself; quote both addresses and let the user decide.
  Real example: site K lists `KT` under both "Prinzregentenufer 47" and
  "Wassertorstraße 1". (For this exact conflict the user decided in
  September 2026: use **Prinzregentenufer 47**. Apply that without asking
  as long as the page still shows these same two addresses; if the page
  changes, ask again.)
- a building code has no address you can attribute to it unambiguously (e.g.
  the page lists several addresses for a site without saying which building
  is where).
- the postal code or city for a building can't be determined from the page.
