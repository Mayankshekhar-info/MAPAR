# MAPAR — PostgreSQL Database Architecture, Setup & Verification Guide

**Document Version:** 1.0.0  
**Phase:** Phase 1 — PostgreSQL Database First  
**Date:** October 17, 2026  
**Status:** **VERIFIED & OPERATIONAL (100% PASS RATE)**  
**Target Engines:** PostgreSQL 15, 17, 18 (Local & Docker)

---

## 1. Database Architecture & Entity Mapping

PostgreSQL serves as the **single source of truth** for all MAPAR enterprise operational intelligence, user identities, organizational hierarchies, upload pipelines, and KPI calculation models.

### 1.1 Dual-Schema Architectural Model

The database comprises **45 total tables** categorized into two architectural tiers:

1. **Native Managed Tables (40 Tables):**
   - Maintained through Django migrations (`apps/*/migrations/`).
   - Enforce database-level referential integrity (`PROTECT` on structural parents, `CASCADE` on child staging rows and audit logs).
   - Use composite unique constraints (e.g. `(batch_id, row_index)` on staged rows).
2. **Unmanaged Legacy Tables (5 Tables):**
   - Mapped to legacy analytics feeds (`managed = False` in `apps/dashboard/models/kpi_models.py`).
   - DDL schema is safely managed via `backend/scripts/seed_database.py` and `backend/conftest.py` with idempotent `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS`.

### 1.2 Complete Table Inventory

| Category | Table Name | Django Model | Persistence Type | Primary Keys / Key Constraints |
|:---|:---|:---|:---|:---|
| **Identity** | `accounts_user` | `User` | Managed | `id (BIGSERIAL)`, `username (UNIQUE)` |
| | `accounts_user_groups` | M2M | Managed | `(user_id, group_id) UNIQUE` |
| | `accounts_user_user_permissions` | M2M | Managed | `(user_id, permission_id) UNIQUE` |
| **Organization** | `organization_maincompany` | `MainCompany` | Managed | `id (BIGSERIAL)`, `code (UNIQUE)` |
| | `organization_subcompany` | `SubCompany` | Managed | `id (BIGSERIAL)`, `code (UNIQUE)`, FK -> `maincompany` |
| | `organization_project` | `Project` | Managed | `id (BIGSERIAL)`, `code (UNIQUE)`, FK -> `subcompany` |
| | `organization_circle` | `Circle` | Managed | `id (BIGSERIAL)`, `code (UNIQUE)`, FK -> `project` |
| | `organization_domain` | `Domain` | Managed | `id (BIGSERIAL)`, `code (UNIQUE)`, FK -> `circle` |
| | `organization_department` | `Department` | Managed | `id (BIGSERIAL)`, `code (UNIQUE)`, FK -> `domain` |
| | `organization_subdepartment` | `SubDepartment` | Managed | `id (BIGSERIAL)`, `code (UNIQUE)`, FK -> `department` |
| | `organization_hierarchyauditlog` | `NodeChangeLog` | Managed | `id (BIGSERIAL)`, Timestamps, User FK |
| **Authorization** | `access_module` | `AccessModule` | Managed | `id (BIGSERIAL)`, `code (UNIQUE)` |
| | `access_permissionaction` | `AccessPermissionAction` | Managed | `id (BIGSERIAL)`, `code (UNIQUE)` |
| | `access_permission` | `AccessPermission` | Managed | `id (BIGSERIAL)`, `code (UNIQUE)` |
| | `access_role` | `AccessRole` | Managed | `id (BIGSERIAL)`, `code (UNIQUE)` |
| | `access_rolepermission` | `AccessRolePermission` | Managed | `id (BIGSERIAL)`, `(role_id, permission_id) UNIQUE` |
| | `access_userrole` | `AccessUserRole` | Managed | `id (BIGSERIAL)`, `(user_id, role_id) UNIQUE` |
| | `access_useraccessscope` | `UserAccessScope` | Managed | `id (BIGSERIAL)`, User FK |
| | `access_useraccessscope_assigned_circles` | M2M | Managed | `(useraccessscope_id, circle_id) UNIQUE` |
| | `access_useraccessscope_assigned_domains` | M2M | Managed | `(useraccessscope_id, domain_id) UNIQUE` |
| **Imports / Pipeline** | `imports_uploadtemplate` | `UploadTemplate` | Managed | `id (BIGSERIAL)`, `code (UNIQUE)` |
| | `imports_uploadtemplateversion` | `UploadTemplateVersion` | Managed | `id (BIGSERIAL)`, `(template_id, version_number) UNIQUE` |
| | `imports_uploadtemplatecolumn` | `TemplateColumn` | Managed | `id (BIGSERIAL)`, `(version_id, column_name) UNIQUE` |
| | `imports_importbatch` | `ImportBatch` | Managed | `id (BIGSERIAL)`, `batch_id (UNIQUE)` |
| | `imports_importstagedrow` | `ImportStagedRow` | Managed | `id (BIGSERIAL)`, `(batch_id, row_index) UNIQUE` |
| | `imports_importvalidationerror` | `ImportValidationError` | Managed | `id (BIGSERIAL)`, FK -> `batch`, `staged_row` |
| | `imports_importauditlineage` | `ImportLineage` | Managed | `id (BIGSERIAL)`, FK -> `batch` |
| **KPI Registry** | `kpi_kpidefinition` | `KPIDefinition` | Managed | `id (BIGSERIAL)`, `code (VARCHAR 50 UNIQUE)` |
| | `kpi_kpiparameter` | `KPIParameter` | Managed | `id (BIGSERIAL)`, FK -> `kpi_kpidefinition` |
| | `kpi_kpifilter` | `KPIFilter` | Managed | `id (BIGSERIAL)`, FK -> `kpi_kpidefinition` |
| | `kpi_kpidependency` | `KPIDependency` | Managed | `id (BIGSERIAL)`, FK -> `kpi_kpidefinition` |
| | `kpi_kpicalculationresult` | `KPIResult` | Managed | `id (BIGSERIAL)`, FK -> `kpi_kpidefinition` |
| | `kpi_kpicalculationauditlog` | `KPICalculationLog` | Managed | `id (BIGSERIAL)`, FK -> `kpi_kpidefinition` |
| **Legacy Analytics** | `organization_reportingperiod` | `ReportingPeriod` | Unmanaged (`False`) | `id (BIGSERIAL)`, `name (UNIQUE)` |
| | `kpis_kpi` | `KPI` | Unmanaged (`False`) | `id (BIGSERIAL)`, `code (VARCHAR 50 UNIQUE)` |
| | `kpis_kpivalue` | `KPIValue` | Unmanaged (`False`) | `id (BIGSERIAL)`, `(kpi_id, circle_id, period_id) UNIQUE` |
| | `governance_issue` | `GovernanceIssue` | Unmanaged (`False`) | `id (BIGSERIAL)`, `issue_code (UNIQUE)` |
| | `governance_actionitem` | `GovernanceActionItem` | Unmanaged (`False`) | `id (BIGSERIAL)`, `action_code (UNIQUE)` |
| **Django System** | `django_migrations`, `auth_*`, `django_content_type`, `django_session`, `django_admin_log` | Django Core | Managed | System tables |

---

## 2. Environment Variables Configuration

The database configuration prioritizes `DB_*` environment variables and falls back cleanly to `POSTGRES_*` variables for backward compatibility. Credentials are never hardcoded.

```dotenv
# ============================================================
# PRIMARY POSTGRESQL CONFIGURATION
# ============================================================
DB_NAME=mapar
DB_USER=postgres
DB_PASSWORD=your_secure_password
DB_HOST=127.0.0.1
DB_PORT=5432
DB_CONN_MAX_AGE=60

# Docker Compose compatibility aliases
POSTGRES_DB=mapar
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_password
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432

# Dedicated test database (used during pytest runs)
TEST_DB_NAME=test_mapar
```

---

## 3. Local PostgreSQL Setup (Windows & Linux)

### 3.1 Windows Service
PostgreSQL 18 runs as a Windows service (`postgresql-x64-18`).

1. Verify server status:
   ```powershell
   Get-Service *postgres*
   & "C:\Program Files\PostgreSQL\18\bin\pg_isready.exe" -h 127.0.0.1 -p 5432
   ```
2. Create MAPAR database:
   ```powershell
   $env:PGPASSWORD='your_password'
   & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -h 127.0.0.1 -p 5432 -c "CREATE DATABASE mapar;"
   ```

### 3.2 Linux / macOS
```bash
sudo systemctl start postgresql
sudo -u postgres psql -c "CREATE DATABASE mapar;"
sudo -u postgres psql -c "CREATE USER mapar WITH ENCRYPTED PASSWORD 'your_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE mapar TO mapar;"
```

---

## 4. Docker Compose Setup

In `docker-compose.yml`, the PostgreSQL service is configured with health checks and persistent storage:

```yaml
  postgres:
    image: postgres:17
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-mapar}
      POSTGRES_USER: ${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER:-postgres} -d $${POSTGRES_DB:-mapar}"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: .
      dockerfile: infrastructure/docker/backend.Dockerfile
    env_file:
      - .env
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
```

---

## 5. Migration & Seeding Procedures

### 5.1 Step 1: Wait for Database Readiness
```bash
python backend/manage.py wait_for_db --timeout 30
```

### 5.2 Step 2: Apply Django Migrations
```bash
python backend/manage.py migrate
```

### 5.3 Step 3: Seed Required Master Data
To seed approved enterprise roles, permissions, base hierarchy, and reporting periods (production-safe, idempotent, zero fabricated operational/KPI data):
```bash
python backend/manage.py seed_master_data
```

### 5.4 Step 4: Seed Sample Development Data (Local / Testing Only)
To seed sample KPI metrics and demo values for local UI exploration:
```bash
python backend/manage.py seed_master_data --with-sample-data
```
*(Guarded against execution in production environments).*

---

## 6. Backup & Restore Procedures

### 6.1 Logical Backup (`pg_dump`)
```powershell
# Custom compressed format (recommended)
pg_dump -U postgres -h 127.0.0.1 -p 5432 -F c -b -v -f "mapar_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').dump" mapar

# Plain SQL format
pg_dump -U postgres -h 127.0.0.1 -p 5432 -F p -v -f "mapar_backup.sql" mapar
```

### 6.2 Database Restoration (`pg_restore`)
```powershell
# Drop and recreate clean target
psql -U postgres -h 127.0.0.1 -c "DROP DATABASE IF EXISTS mapar_restore;"
psql -U postgres -h 127.0.0.1 -c "CREATE DATABASE mapar_restore;"

# Restore from compressed dump
pg_restore -U postgres -h 127.0.0.1 -d mapar_restore -v "mapar_backup.dump"
```

---

## 7. Unmanaged Legacy Table Ownership & DDL

The 5 legacy models in `backend/apps/dashboard/models/kpi_models.py` are explicitly marked `managed = False`:

```python
class KPI(models.Model):
    id = models.BigAutoField(primary_key=True)
    code = models.CharField(unique=True, max_length=50) # Aligned with KPIDefinition
    ...
    class Meta:
        managed = False
        db_table = "kpis_kpi"
```

### Verified DDL Schema:
```sql
CREATE TABLE IF NOT EXISTS organization_reportingperiod (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    period_type VARCHAR(20) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    freeze_at TIMESTAMP WITH TIME ZONE,
    is_frozen BOOLEAN DEFAULT FALSE,
    is_current BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_reportingperiod_current ON organization_reportingperiod(is_current);

CREATE TABLE IF NOT EXISTS kpis_kpi (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    definition TEXT DEFAULT '',
    calculation_formula TEXT DEFAULT '',
    unit VARCHAR(50) DEFAULT '',
    direction VARCHAR(20) DEFAULT 'HIGHER_BETTER',
    frequency VARCHAR(20) DEFAULT 'MONTHLY',
    risk_category VARCHAR(100) DEFAULT '',
    priority VARCHAR(20) DEFAULT 'MEDIUM',
    default_owner VARCHAR(100) DEFAULT '',
    is_executive BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,
    domain_id BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_kpi_code ON kpis_kpi(code);

CREATE TABLE IF NOT EXISTS kpis_kpivalue (
    id BIGSERIAL PRIMARY KEY,
    kpi_id BIGINT NOT NULL,
    circle_id BIGINT NOT NULL,
    period_id BIGINT NOT NULL,
    actual_value NUMERIC(15, 2),
    target_value NUMERIC(15, 2),
    previous_value NUMERIC(15, 2),
    numerator_value NUMERIC(15, 2),
    denominator_value NUMERIC(15, 2),
    variance_to_target NUMERIC(15, 2),
    variance_percentage NUMERIC(8, 2),
    rag_status VARCHAR(20) DEFAULT 'GREEN',
    trend VARCHAR(20) DEFAULT 'FLAT',
    notes TEXT DEFAULT '',
    entered_by_id BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (kpi_id, circle_id, period_id)
);
CREATE INDEX IF NOT EXISTS idx_kpivalue_circle_period ON kpis_kpivalue(circle_id, period_id);
CREATE INDEX IF NOT EXISTS idx_kpivalue_rag ON kpis_kpivalue(rag_status);
```

---

## 8. Verification & Persistence Test Results

Execution of the dedicated integration test suite `backend/tests/test_postgresql_persistence.py` and the complete backend test suite directly against **PostgreSQL**:

```text
============================= test session starts =============================
platform win32 -- Python 3.14.6, pytest-8.3.2, pluggy-1.6.0
django: version: 4.2.30, settings: config.settings.postgres_testing
rootdir: E:\Mapar
collected 167 items

backend\apps\audit\tests\test_services.py .                              [  0%]
backend\apps\authorization\tests\test_authorization.py ..                [  1%]
backend\apps\authorization\tests\test_hierarchy_downward_scope.py ...... [  5%]
...
backend\apps\dashboard\tests\test_cockpit_service.py ......              [ 16%]
backend\apps\dashboard\tests\test_slide_hierarchy_service.py ........... [ 23%]
backend\apps\imports\tests\test_e2e_complete_flow.py .                   [ 31%]
backend\apps\imports\tests\test_uploads_engine.py ......                 [ 45%]
backend\apps\kpi\tests\test_kpi_engine.py .............................. [ 63%]
backend\tests\test_audit_regressions.py ...                              [ 96%]
backend\tests\test_postgresql_persistence.py .....                       [100%]

====================== 167 passed in 13.71s =======================
```

### Verified Criteria Checklist
- [x] **API Creation & Direct SQL Verification:** Record created via `POST /api/v1/organization/nodes/` verified in PostgreSQL via raw cursor query.
- [x] **API Read & Update Persistence:** Retrieved and updated via API, verified directly in PostgreSQL table.
- [x] **Relational Foreign Key Constraints:** Invalid foreign keys rejected with HTTP 400 and verified raising `IntegrityError` at PostgreSQL database engine level.
- [x] **Atomic Transaction Rollback:** Errors inside `transaction.atomic()` roll back completely, persisting zero orphan records.
- [x] **Scoped Multi-Branch Isolation:** Organization cross-branch access restrictions validated under PostgreSQL.
- [x] **Schema Consistency:** Fixed `kpis_kpi.code` `VARCHAR(20)` length bottleneck by expanding to `VARCHAR(50)`, aligning with `KPIDefinition.code`.
- [x] **Zero Fallback to SQLite:** Confirmed active connection vendor is `postgresql` and engine is genuine PostgreSQL 18.
