CREATE TABLE IF NOT EXISTS "insurances" (
    "id_insurance" SERIAL PRIMARY KEY,
    "name_insurance" VARCHAR(255) NOT NULL,
    "coverage_percentage" DECIMAL NOT NULL
);

CREATE TABLE IF NOT EXISTS "doctors" (
    "id_doctor" SERIAL PRIMARY KEY,
    "name_doctor" VARCHAR(255) NOT NULL,
    "email_doctor" VARCHAR(255) NOT NULL UNIQUE,
    "specialty_doctor" VARCHAR(255)
);

-- TABLAS CON FK INTEGRADAS (Llevan la relación por dentro)

CREATE TABLE IF NOT EXISTS "patients" (
    "patient_id" SERIAL PRIMARY KEY,
    "patient_name" VARCHAR(255) NOT NULL,
    "patient_email" VARCHAR(255) NOT NULL UNIQUE,
    "patient_phone" VARCHAR(255) NOT NULL,
    "patient_address" VARCHAR(255),
    -- El paciente ahora tiene su seguro amarrado aquí mismo
    "insurance_id" INTEGER REFERENCES "insurances"("id_insurance") 
);

CREATE TABLE IF NOT EXISTS "appointments" (
    "id_appointments" SERIAL PRIMARY KEY,
    "date_appointment" DATE NOT NULL,
    "treatment_code" VARCHAR(50) NOT NULL,
    "treatment_description" VARCHAR(255) NOT NULL,
    "treatment_cost" NUMERIC(12,2) NOT NULL,
    "amount_paid" NUMERIC(12,2) NOT NULL,
    -- La cita amarra al paciente y al doctor aquí mismo
    "patient_id" INTEGER NOT NULL REFERENCES "patients"("patient_id"),
    "doctor_id" INTEGER NOT NULL REFERENCES "doctors"("id_doctor")
);