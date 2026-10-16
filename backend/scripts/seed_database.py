import os
import sys
from pathlib import Path

# Add backend directory to sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

import django
import datetime
from decimal import Decimal

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")
django.setup()


from django.db import connection
from apps.identity.models import User
from apps.organization.models import MainCompany, SubCompany, Project, Circle, Domain
from apps.dashboard.models import ReportingPeriod, KPI, KPIValue

def seed_db():
    print("Ensuring unmanaged tables exist in PostgreSQL...")
    with connection.cursor() as cursor:
        cursor.execute("""
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
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS kpis_kpi (
                id BIGSERIAL PRIMARY KEY,
                code VARCHAR(20) UNIQUE NOT NULL,
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
        """)
        cursor.execute("""
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
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS governance_issue (
                id BIGSERIAL PRIMARY KEY,
                issue_code VARCHAR(50) UNIQUE NOT NULL,
                title VARCHAR(255) NOT NULL,
                description TEXT DEFAULT '',
                severity VARCHAR(20) DEFAULT 'MEDIUM',
                status VARCHAR(30) DEFAULT 'OPEN',
                rag_status VARCHAR(10) DEFAULT 'AMBER',
                escalation_level VARCHAR(30) DEFAULT 'LEVEL_1',
                root_cause TEXT DEFAULT '',
                corrective_action TEXT DEFAULT '',
                preventive_action TEXT DEFAULT '',
                owner_name VARCHAR(100) DEFAULT '',
                target_date DATE,
                closure_date DATE,
                is_repeat BOOLEAN DEFAULT FALSE,
                circle_id BIGINT,
                domain_id BIGINT,
                kpi_id BIGINT,
                created_by_id BIGINT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS governance_actionitem (
                id BIGSERIAL PRIMARY KEY,
                action_code VARCHAR(50) UNIQUE NOT NULL,
                source VARCHAR(100) DEFAULT '',
                review_date DATE,
                management_direction TEXT DEFAULT '',
                rca_issue TEXT DEFAULT '',
                expected_outcome TEXT DEFAULT '',
                accountable_owner VARCHAR(100),
                supporting_owner VARCHAR(100) DEFAULT '',
                priority VARCHAR(20) DEFAULT 'MEDIUM',
                action_date DATE,
                target_date DATE,
                status VARCHAR(30) DEFAULT 'IN_PROGRESS',
                progress_percentage INTEGER DEFAULT 0,
                latest_update TEXT DEFAULT '',
                dependency TEXT DEFAULT '',
                last_update_date DATE,
                ageing_days INTEGER DEFAULT 0,
                overdue_days INTEGER DEFAULT 0,
                governance_rag VARCHAR(10) DEFAULT 'AMBER',
                escalation_level VARCHAR(50) DEFAULT '',
                closure_date DATE,
                closure_remarks TEXT DEFAULT '',
                circle_id BIGINT,
                domain_id BIGINT,
                kpi_id BIGINT,
                issue_id BIGINT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """)

    print("Creating superuser...")
    admin, created = User.objects.get_or_create(
        username="admin",
        defaults={
            "email": "admin@mapar.com",
            "role": User.Role.SUPER_ADMIN,
            "status": User.Status.ACTIVE,
            "is_staff": True,
            "is_superuser": True,
            "first_name": "System",
            "last_name": "Admin",
        }
    )
    admin.set_password("admin123")
    admin.save()
    print(f"Superuser {'created' if created else 'updated'}: username='admin', password='admin123'")

    print("Creating organization hierarchy...")
    mc, _ = MainCompany.objects.get_or_create(
        code="MAPAR_ENT",
        defaults={"name": "MAPAR Enterprise", "description": "Primary Corporate Enterprise"}
    )
    sc, _ = SubCompany.objects.get_or_create(
        code="MAPAR_TEL",
        main_company=mc,
        defaults={"name": "MAPAR Telecom Infra", "description": "Telecom Infrastructure Division"}
    )
    prj, _ = Project.objects.get_or_create(
        code="PRJ_ROLLOUT",
        sub_company=sc,
        defaults={"name": "4G/5G Network Rollout", "description": "National Rollout Initiative"}
    )
    circles = []
    for c_code, c_name, c_reg in [
        ("AP", "Andhra Pradesh", "South"),
        ("MH", "Maharashtra", "West"),
        ("DL", "Delhi NCR", "North"),
    ]:
        circ, _ = Circle.objects.get_or_create(
            code=c_code,
            defaults={"name": c_name, "project": prj, "region": c_reg, "is_active": True}
        )
        circles.append(circ)

    domains = []
    for d_code, d_name in [
        ("OPS", "Operations & Maintenance"),
        ("GOV", "Project Governance"),
        ("QC", "Quality & Compliance"),
    ]:
        dom, _ = Domain.objects.get_or_create(
            code=d_code,
            defaults={"name": d_name, "circle": circles[0], "is_active": True}
        )
        domains.append(dom)

    print("Creating reporting periods...")
    periods_data = [
        ("Jul-26", "MONTHLY", datetime.date(2026, 7, 1), datetime.date(2026, 7, 31), True, False),
        ("Aug-26", "MONTHLY", datetime.date(2026, 8, 1), datetime.date(2026, 8, 31), True, False),
        ("Sep-26 MTD", "MONTHLY", datetime.date(2026, 9, 1), datetime.date(2026, 9, 30), False, True),
        ("Monthly: October 2026", "MONTHLY", datetime.date(2026, 10, 1), datetime.date(2026, 10, 31), False, False),
    ]
    for p_name, p_type, p_start, p_end, is_froz, is_curr in periods_data:
        ReportingPeriod.objects.get_or_create(
            name=p_name,
            defaults={
                "period_type": p_type,
                "start_date": p_start,
                "end_date": p_end,
                "is_frozen": is_froz,
                "is_current": is_curr,
            }
        )

    print("Creating sample KPI and values...")
    kpi, _ = KPI.objects.get_or_create(
        code="KPI_SITES_ON_AIR",
        defaults={
            "name": "Sites On Air",
            "domain": domains[0],
            "unit": "Sites",
            "direction": "HIGHER_BETTER",
            "frequency": "MONTHLY",
        }
    )
    current_period = ReportingPeriod.objects.filter(is_current=True).first()
    if current_period:
        for circ in circles:
            KPIValue.objects.get_or_create(
                kpi=kpi,
                circle=circ,
                period=current_period,
                defaults={
                    "actual_value": Decimal("145.00"),
                    "target_value": Decimal("150.00"),
                    "variance_to_target": Decimal("-5.00"),
                    "variance_percentage": Decimal("-3.33"),
                    "rag_status": "AMBER",
                }
            )

    print("Database seeding completed successfully!")

if __name__ == "__main__":
    seed_db()
