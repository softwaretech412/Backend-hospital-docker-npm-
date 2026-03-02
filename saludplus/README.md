# SaludPlus – Hybrid Persistence API

A REST API for the **SaludPlus** clinic network, implementing a hybrid persistence architecture: **PostgreSQL** for normalized, transactional data and **MongoDB** for read-optimized patient histories.

## Project overview

- **Stack:** Node.js 18+, Express 4.x, PostgreSQL 12+, MongoDB 6+
- **Role:** Migrate from a single CSV source into a relational schema (PostgreSQL) and document store (MongoDB), and expose data via REST endpoints.

## Architecture decisions

### Why a hybrid (SQL + NoSQL) design?

- **PostgreSQL** is used for:
  - Master data (patients, doctors, insurances) with **referential integrity** and **ACID** guarantees.
  - **Appointments** as transactional records with foreign keys to patients, doctors, and insurances.
  - **Revenue and reporting** with precise aggregations and no duplication.

- **MongoDB** is used for:
  - **Patient histories**: one document per patient with an embedded array of appointments. This avoids joins and allows **fast reads** for “give me everything for this patient” (e.g. &lt; 100 ms for dozens of appointments).

### SQL normalization

- **1NF:** No repeating groups; each row has atomic values.
- **2NF:** No partial dependencies; non-key attributes depend on the whole primary key.
- **3NF:** No transitive dependencies; only key and direct dependencies remain.

**Tables:**

- `patients` (id, name, email UNIQUE, phone, address)
- `doctors` (id, name, email UNIQUE, specialty)
- `insurances` (id, name UNIQUE, coverage_percentage)
- `appointments` (id, appointment_id UNIQUE, appointment_date, patient_id FK, doctor_id FK, treatment_code, treatment_description, treatment_cost, insurance_id FK, amount_paid)

Indexes are defined on foreign keys and frequently filtered columns (e.g. `appointment_date`, `patients.email`, `doctors.specialty`).

### NoSQL document design

- **Collection:** `patient_histories`
- **Embedding:** Appointments are **embedded** inside each patient document so that a single read returns the full history. No joins are needed.
- **References:** Only the patient is identified by email; doctor/insurance data is denormalized (name, email, specialty, etc.) inside each appointment subdocument to keep reads fast and the API response self-contained.

## Database schemas

### PostgreSQL (main entities)

- **patients:** id (SERIAL), name, email (UNIQUE), phone, address  
- **doctors:** id (SERIAL), name, email (UNIQUE), specialty, created_at  
- **insurances:** id (SERIAL), name (UNIQUE), coverage_percentage  
- **appointments:** id (SERIAL), appointment_id (UNIQUE), appointment_date, patient_id → patients(id), doctor_id → doctors(id), treatment_code, treatment_description, treatment_cost, insurance_id → insurances(id), amount_paid  

### MongoDB (patient_histories)

Example document:

```json
{
  "patientEmail": "paciente@email.com",
  "patientName": "Nombre Completo",
  "appointments": [
    {
      "appointmentId": "APT-1001",
      "date": "2024-01-07",
      "doctorName": "Dr. Carlos Ruiz",
      "doctorEmail": "c.ruiz@saludplus.com",
      "specialty": "Cardiology",
      "treatmentCode": "TRT-007",
      "treatmentDescription": "Skin Treatment",
      "treatmentCost": 200000,
      "insuranceProvider": "ProteccionMedica",
      "coveragePercentage": 60,
      "amountPaid": 80000
    }
  ]
}
```

Index: `patientEmail` (unique / frequent lookup).

## API documentation

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/simulacro` | Simulacro module info |
| POST | `/api/simulacro/migrate` | Run CSV migration (body: `{ "clearBefore": true }` optional) |
| GET | `/api/doctors` | List doctors (query: `?specialty=Cardiology`) |
| GET | `/api/doctors/:id` | Get doctor by id |
| PUT | `/api/doctors/:id` | Update doctor (propagates to MongoDB histories) |
| GET | `/api/reports/revenue` | Revenue report (query: `?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`) |
| GET | `/api/patients` | List all patients (from PostgreSQL) |
| GET | `/api/patients/:email/history` | Patient history by email (from MongoDB) |
| GET | `/api/histories` | List all patient histories (from MongoDB; email, name, appointment count) |

### Example responses

**POST /api/simulacro/migrate** (200):

```json
{
  "ok": true,
  "message": "Migration completed successfully",
  "result": {
    "patients": 150,
    "doctors": 25,
    "insurances": 5,
    "appointments": 500,
    "histories": 150,
    "csvPath": "./data/simulation_saludplus_data.csv"
  }
}
```

**GET /api/patients/valeria.g@mail.com/history** (200):

```json
{
  "ok": true,
  "patient": { "email": "valeria.g@mail.com", "name": "Valeria Gomez" },
  "appointments": [ ... ],
  "summary": {
    "totalAppointments": 5,
    "totalSpent": 500000,
    "mostFrequentSpecialty": "Cardiology"
  }
}
```

Errors return `{ "ok": false, "error": "..." }` with appropriate HTTP status (400, 404, 500).

## Setup instructions

### Prerequisites

- Node.js 18+
- PostgreSQL 12+ (**must be running** and accepting connections on the host/port in `DATABASE_URL`)
- MongoDB 6+

### Install and run (npm)

1. Clone the repo and install dependencies:

   ```bash
   cd saludplus
   npm install
   ```

2. Copy environment template and set variables:

   **Linux / macOS:**
   ```bash
   cp .env.example .env
   ```
   **Windows (Command Prompt):**
   ```cmd
   copy .env.example .env
   ```
   **Windows (PowerShell):**
   ```powershell
   Copy-Item .env.example .env
   ```
   Then edit `.env` with your `DATABASE_URL`, `MONGODB_URI`, and `MONGODB_DB`.

3. Place the CSV file at the path set in `SIMULACRO_CSV_PATH` (default: `./data/simulation_saludplus_data.csv`). Columns expected: `appointment_id`, `appointment_date`, `patient_name`, `patient_email`, `patient_phone`, `patient_address`, `doctor_name`, `doctor_email`, `specialty`, `treatment_code`, `treatment_description`, `treatment_cost`, `insurance_provider`, `coverage_percentage`, `amount_paid`.

4. Start the server. The app will create the PostgreSQL database automatically if it does not exist, then create tables and connect to MongoDB:

   ```bash
   npm start
   ```

5. Run the migration (once DBs are up; use `clearBefore: true` to reset and reload):

   **Linux / macOS / WSL:**
   ```bash
   curl -X POST http://localhost:3000/api/simulacro/migrate -H "Content-Type: application/json" -d '{"clearBefore": true}'
   ```
   **Windows (PowerShell):**
   ```powershell
   Invoke-RestMethod -Uri http://localhost:3000/api/simulacro/migrate -Method POST -ContentType "application/json" -Body '{"clearBefore": true}'
   ```
   Or use Postman: `POST http://localhost:3000/api/simulacro/migrate` with body `{ "clearBefore": true }`.

### Run with Docker

You can run the whole stack (PostgreSQL, MongoDB, and the API) with Docker Compose. No need to install Node, PostgreSQL, or MongoDB locally.

1. From the project root (`saludplus/`):

   ```bash
   docker compose up --build
   ```

   This starts:
   - **postgres** on port 5432 (user `postgres`, password `postgres`, database `saludplus`)
   - **mongo** on port 27017
   - **app** on port 3000 (API)

2. After the app is up, run the migration:

   ```bash
   curl -X POST http://localhost:3000/api/simulacro/migrate -H "Content-Type: application/json" -d "{\"clearBefore\": true}"
   ```

3. Optional: run in the background with `docker compose up -d --build`. To change the Postgres password or other settings, set environment variables in a `.env` file in the same directory as `docker-compose.yml` or pass them when running `docker compose`.

**Run only the databases with Docker (app with npm):**

```bash
docker compose up -d postgres mongo
```
*(On older Docker setups you may need `docker-compose` with a hyphen.)*

Then in `.env` use `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/saludplus` and `MONGODB_URI=mongodb://localhost:27017`, and start the app with `npm start`.

### Platform notes (Windows & Ubuntu / Linux)

- **Node.js:** Install LTS from [nodejs.org](https://nodejs.org). On Windows, avoid installing in a path with spaces (e.g. use `C:\Node` or the default).
- **Paths:** All file paths in the app use Node’s `path` module and work on both Windows and Linux. In `.env`, you can use forward slashes for `SIMULACRO_CSV_PATH` (e.g. `./data/simulation_saludplus_data.csv`) on all platforms.
- **Line endings:** The repo uses LF (`.gitattributes`). Git will normalize line endings on checkout so the codebase is consistent on Windows and Ubuntu.
- **Docker:** On Windows use [Docker Desktop](https://www.docker.com/products/docker-desktop/); on Ubuntu use the standard Docker Engine. Use `docker compose` (space) or `docker-compose` (hyphen) depending on your version.

## Usage examples

- List patients: `GET http://localhost:3000/api/patients`  
- List doctors: `GET http://localhost:3000/api/doctors`  
- Filter doctors by specialty: `GET http://localhost:3000/api/doctors?specialty=Cardiology`  
- List all patient histories: `GET http://localhost:3000/api/histories`  
- Patient history by email: `GET http://localhost:3000/api/patients/valeria.g@mail.com/history`  
- Revenue report: `GET http://localhost:3000/api/reports/revenue`  
- Revenue in date range: `GET http://localhost:3000/api/reports/revenue?startDate=2024-01-01&endDate=2024-12-31`

## Scripts

- `npm start` — Start the API server (creates DB and tables if needed).
- `npm run migrate` — Run migration from CSV without clearing existing data.
- `npm run migrate:clear` — Run migration with `clearBefore: true` (truncate then reload).

**Docker:**

- `docker compose up --build` — Build and run app + PostgreSQL + MongoDB.
- `docker compose up -d postgres mongo` — Run only the databases (use `npm start` for the app).

## Postman

Use the provided `SaludPlus_API.postman_collection.json` with environment variables: `baseUrl` = `http://localhost:3000`, `patientEmail` = `valeria.g@mail.com`, `doctorId` = `1`. The collection includes all endpoints listed above.
