-- Stage 3: incident severity, due time, and company-level policy thresholds.

-- 1. New enum for incident severity.
CREATE TYPE "IncidentSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- 2. Company-level policy values that drive severity/due-time rules.
ALTER TABLE "Company"
  ADD COLUMN "lateSeverityThresholdMinutes" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN "incidentDueMinutesCritical" INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN "incidentDueMinutesHigh" INTEGER NOT NULL DEFAULT 240,
  ADD COLUMN "incidentDueMinutesMedium" INTEGER NOT NULL DEFAULT 1440,
  ADD COLUMN "incidentDueMinutesLow" INTEGER NOT NULL DEFAULT 4320;

-- 3. Severity and due time on each incident.
ALTER TABLE "AttendanceIncident"
  ADD COLUMN "severity" "IncidentSeverity" NOT NULL DEFAULT 'MEDIUM',
  ADD COLUMN "dueAt" TIMESTAMP(3);

-- 4. Index supporting the incident inbox's severity/status filtering.
CREATE INDEX "AttendanceIncident_companyId_severity_status_idx"
  ON "AttendanceIncident" ("companyId", "severity", "status");