# SupportDesk

Prototype til håndtering af IT-supportsager på en uddannelsesinstitution.
Løser casens kerneproblem: **to medarbejdere må aldrig overtage den samme sag** – og supportafdelingen skal kunne følge en sag fra åben til afsluttet.

Teknologi: **Node.js, Express, MongoDB (Mongoose), HTML/CSS/JavaScript, Vitest + Supertest**.

---

## Kør projektet

```bash
npm install
npm start          # http://localhost:3000  (frontend + API)
npm test           # kører alle 14 tests incl. PO's to accepttests
npm run demo:concurrency   # demonstrerer krav 3 over HTTP
```

- Uden `MONGO_URI` startes automatisk en **MongoDB i hukommelsen** (mongodb-memory-server) – praktisk til demo og test.
- I drift: sæt `MONGO_URI`, f.eks. `MONGO_URI=mongodb://localhost:27017/supportdesk npm start`. Data gemmes i MongoDB og overlever genstart (krav 6).
- En tom database fyldes automatisk med 3 medarbejdere og 4 supportsager (krav 1: mindst tre sager). Nulstil med `npm run seed`.

## Arkitektur

```text
Browser (HTML/CSS/JS, fetch)
        │  HTTP / JSON
        ▼
Express-app (src/app.js)  ──  øverste fejl-middleware (ingen crash)
  ├─ /api/tickets      ruter + validering
  ├─ /api/assignments  atomisk overtagelse
  ├─ /api/employees    medarbejderliste
  └─ ensureConnected()  ── Mongoose ──► MongoDB
```

- `src/app.js` eksporterer Express-appen **uden** at starte serveren – det er kontrakten til PO's tests (Supertest importerer appen direkte).
- `src/server.js` starter HTTP-serveren og DB-forbindelsen.
- `src/models/` – Mongoose-modeller: `Ticket` (status + én ansvarlig), `Employee`, `Assignment` (journal over gennemførte overtagelser).
- `src/db.js` – forbindelse, memoizeret `ensureConnected()` og status-flowet `open → in_progress → closed`.
- `public/` – brugergrænsefladen, der taler med API'et udelukkende via `fetch` (GET/POST/PATCH, HTTP-statuskoder og `error`-feltet vises i UI'et).

## API

| Metode & sti | Funktion | Fejl |
|---|---|---|
| `GET /api/tickets` | Alle sager med status og ansvarlig (`?status=open` filtrerer) | – |
| `GET /api/tickets/:id` | Én sag | 404 hvis den ikke findes |
| `POST /api/tickets` | Opret sag | 400 hvis titel mangler |
| `PATCH /api/tickets/:id/status` | Skift status `{status, employeeId}` – kun den ansvarlige, kun `open→in_progress→closed` | 400/403/404 |
| `POST /api/assignments` | Overtag sag `{ticketId, employeeId}` | 400/404/409 |
| `GET /api/assignments` | Journal over gennemførte overtagelser | – |
| `GET /api/employees` | Medarbejdere | – |

Alle fejl returneres som `{ "error": "..." }` med en forståelig dansk besked og **den korrekte HTTP-status** (400 ugyldige data, 404 findes ikke, 403 forbudt, 409 konflikt). Serveren crasher aldrig på grund af disse fejl (krav 5).

## Sådan håndteres samtidighed (krav 3)

Ida og Noah rammer samme ledige sag på samme tid. Overtagelsen udføres som **ét atomisk databasekald**:

```js
Ticket.findOneAndUpdate(
  { _id: ticket._id, assignedTo: null },   // matcher KUN hvis sagen stadig er ledig
  { $set: { assignedTo: employee._id, assignedAt: new Date() } },
  { new: true }
);
```

MongoDB garanterer, at betingelsen og opdateringen sker i én udelelig operation. Selv når flere requests kommer samtidig, kan kun ét kald se `assignedTo: null` og vinde – alle andre får HTTP 409 med beskeden *"Sagen er allerede overtaget af en anden medarbejder."* Ingen låse eller køer er derfor nødvendige, og der kan aldrig opstå dobbelte ansvar (race condition er elimineret i databasen, ikke i Node-processen).

**Demonstration:** `npm run demo:concurrency` starter serveren og sender tre parallelle overtagelser (Ida, Noah, Sofia) af samme sag. Forventet output: 1 × `201 FIK SAGEN`, 2 × `409 AFVIST`, og databasen har præcis én ansvarlig. Denne situation er også automatiseret i `tests/extra.test.js` ("Krav 3").

## Tests

```bash
npm test
```

- `tests/api.test.js` – **product owners to accepttests, uændrede**.
- `tests/extra.test.js` – 12 tests der dækker examens testscenarier:

| Testscenarie | Forventet resultat | Dækket af |
|---|---|---|
| Hent supportsager | Viser sager og status | `viser mindst tre tickets`, `viser sager med status og ansvarlig` |
| Overtag ledig sag | Overtagelse gennemføres og gemmes | `gennemfører en overtagelse...`, `assignment-journalen` |
| Overtag tildelt sag | Afvises (409) | `afviser overtagelse af en allerede tildelt sag` |
| Ugyldige oplysninger | Håndteres korrekt (400) | PO-test 2, `afviser ukendt medarbejder`, `afviser ugyldig statusværdi` |
| To samtidige overtagelser | Kun én får sagen | `Krav 3-testen` med 3 parallelle POSTs, + `npm run demo:concurrency` |
| Opdatér status | Ny status gemmes og vises | `gennemfører forløbet åben → under behandling → afsluttet` |
| Afslut en sag | Fremstår som afsluttet | samme test: den findes ikke længere under `?status=open` |

Alle 14 tests består (`Vitest`, 2 filer). Der køres med en MongoDB i hukommelsen, så testene er uafhængige af en lokal database.

## Arbejdsform (GitHub Projects/Issues)

Udviklingsarbejdet organiseres med GitHub Projects (backlog → in progress → review → done) med Issues svarende til leverancerne:

1. Opsæt projekt (Node/Express/Mongo, mappestruktur) – arkitektur Issue
2. Datamodel + seed (krav 1, 6)
3. Overtagelse med atomisk opdatering (krav 2, 3)
4. Statusflow (krav 4)
5. Fejlhåndtering (krav 5)
6. Frontend
7. Tests incl. samtidighedstest og demo

Hver Issue lukkes med commit(s), der henviser til Issue-nummeret (`#3` f.eks.), og feature-branches merges til `main`.

## Krav-tjekliste

- [x] Krav 1 – oversigt, entydige id'er (MongoDB ObjectId), ledig/overtaget-flag, 4 sager i seed
- [x] Krav 2 – overtagelse knytter medarbejder til sag, journal i `assignments`, én ansvarlig ad gangen, forståelige fejlbeskeder
- [x] Krav 3 – atomisk `findOneAndUpdate`; demonstreret både med automatiseret test og demo-program
- [x] Krav 4 – statusflow `open → in_progress → closed`, kun for den ansvarlige; afsluttet sag er ikke åben
- [x] Krav 5 – 400/403/404/409 med danske fejlbeskeder; ingen data ændres ved afviste handlinger; serveren crasher ikke
- [x] Krav 6 – data i MongoDB; overtager data overlever genstart af appen
- [x] Frontend – se sager, vælge medarbejder, overtage ledig sag, ændre status, se fejlbeskeder
- [x] PO's to accepttests bestået uændrede
