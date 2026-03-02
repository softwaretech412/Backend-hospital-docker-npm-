# SaludPlus – Hybrid Persistence API (Docs)

Short reference for the SaludPlus API and project layout. For full documentation see the root [README.md](../README.md).

---

## Project structure

```
saludplus/
├── src/
│   ├── config/
│   │   ├── env.js          # Environment variables
│   │   ├── postgres.js     # PostgreSQL connection + schema (auto-creates DB if missing)
│   │   └── mongodb.js      # MongoDB connection + PatientHistory model
│   ├── services/
│   │   ├── migrationService.js  # CSV → PostgreSQL + MongoDB
│   │   ├── doctorService.js
│   │   ├── reportService.js
│   │   └── patientService.js
│   ├── routes/
│   │   ├── simulacro.js    # POST /api/simulacro/migrate
│   │   ├── doctors.js
│   │   ├── reports.js
│   │   ├── patients.js
│   │   └── histories.js
│   ├── app.js
│   └── server.js
├── scripts/
│   └── run-migration.js    # CLI: npm run migrate / npm run migrate:clear
├── data/
│   └── simulation_saludplus_data.csv
├── .env.example
├── .env                    # Not committed
├── package.json
├── README.md
└── SaludPlus_API.postman_collection.json
```

---

## API endpoints (quick reference)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/simulacro` | Simulacro info |
| POST | `/api/simulacro/migrate` | Run migration (`{ "clearBefore": true }` optional) |
| GET | `/api/doctors` | List doctors (`?specialty=`) |
| GET | `/api/doctors/:id` | Get doctor by id |
| PUT | `/api/doctors/:id` | Update doctor (propagates to MongoDB) |
| GET | `/api/reports/revenue` | Revenue report (`?startDate=&endDate=`) |
| GET | `/api/patients` | List all patients |
| GET | `/api/patients/:email/history` | Patient history by email |
| GET | `/api/histories` | List all patient histories |

---

## Run

**With npm:**

```bash
npm install
cp .env.example .env   # Edit with your DATABASE_URL and MONGODB_URI
npm start
# Then: POST http://localhost:3000/api/simulacro/migrate with body { "clearBefore": true }
```

**With Docker (full stack):**

```bash
docker compose up --build
# Then: POST http://localhost:3000/api/simulacro/migrate with body { "clearBefore": true }
```

---

**SaludPlus** – Hybrid persistence (PostgreSQL + MongoDB) – 2026
