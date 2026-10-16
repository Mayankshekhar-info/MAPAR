import os
import django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.testing")
django.setup()

import datetime
from decimal import Decimal
import pytest
from django.db import connection

@pytest.fixture(autouse=True)
def ensure_unmanaged_tables_and_baseline_data(db):
    """
    Ensure unmanaged KPI & ReportingPeriod tables exist in the test sqlite database,
    and seed baseline organization & operational records if empty.
    """
    with connection.cursor() as cursor:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS organization_reportingperiod (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR(100) UNIQUE,
                period_type VARCHAR(20),
                start_date DATE,
                end_date DATE,
                freeze_at DATETIME,
                is_frozen BOOLEAN DEFAULT 0,
                is_current BOOLEAN DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS kpis_kpi (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code VARCHAR(20) UNIQUE,
                name VARCHAR(200),
                definition TEXT DEFAULT '',
                calculation_formula TEXT DEFAULT '',
                unit VARCHAR(50) DEFAULT '',
                direction VARCHAR(20) DEFAULT 'HIGHER_BETTER',
                frequency VARCHAR(20) DEFAULT 'MONTHLY',
                risk_category VARCHAR(100) DEFAULT '',
                priority VARCHAR(20) DEFAULT 'MEDIUM',
                default_owner VARCHAR(100) DEFAULT '',
                is_executive BOOLEAN DEFAULT 0,
                is_active BOOLEAN DEFAULT 1,
                display_order INTEGER DEFAULT 0,
                domain_id INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS kpis_kpivalue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                kpi_id INTEGER,
                circle_id INTEGER,
                period_id INTEGER,
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
                entered_by_id INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (kpi_id, circle_id, period_id)
            );
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS governance_issue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                issue_code VARCHAR(50) UNIQUE,
                title VARCHAR(255),
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
                is_repeat BOOLEAN DEFAULT 0,
                circle_id INTEGER,
                domain_id INTEGER,
                kpi_id INTEGER,
                created_by_id INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS governance_actionitem (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                action_code VARCHAR(50) UNIQUE,
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
                circle_id INTEGER,
                domain_id INTEGER,
                kpi_id INTEGER,
                issue_id INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        """)

    from apps.organization.models import MainCompany, SubCompany, Project, Circle, Domain
    from apps.dashboard.models import ReportingPeriod, KPI, KPIValue

    if Circle.objects.count() == 0:
        mc, _ = MainCompany.objects.get_or_create(code="GLOBAL_TEST_CORP", defaults={"name": "Global Test Corp"})
        sc, _ = SubCompany.objects.get_or_create(code="SUB_TEST_CORP", defaults={"name": "Sub Test Corp", "main_company": mc})
        prj, _ = Project.objects.get_or_create(code="PRJ_TEST", defaults={"name": "Project Test", "sub_company": sc})
        circle, _ = Circle.objects.get_or_create(code="CIR_DEFAULT_TEST", defaults={"name": "Default Test Circle", "project": prj, "region": "North"})
        dom, _ = Domain.objects.get_or_create(code="DOM_DEFAULT_TEST", defaults={"name": "Default Test Domain", "circle": circle})

        period = ReportingPeriod.objects.filter(is_current=True).first()
        if not period:
            period, _ = ReportingPeriod.objects.get_or_create(
                name="Default Reporting Cycle",
                defaults={
                    "period_type": "MONTHLY",
                    "start_date": datetime.date(2026, 1, 1),
                    "end_date": datetime.date(2026, 1, 31),
                    "is_current": True,
                }
            )

        kpi, _ = KPI.objects.get_or_create(
            code="KPI_BASELINE_01",
            defaults={
                "name": "Baseline Test KPI",
                "domain": dom,
                "unit": "Units",
                "direction": "HIGHER_BETTER",
            }
        )

        KPIValue.objects.get_or_create(
            kpi=kpi,
            circle=circle,
            period=period,
            defaults={
                "actual_value": Decimal("100.00"),
                "target_value": Decimal("90.00"),
                "variance_to_target": Decimal("10.00"),
                "variance_percentage": Decimal("11.11"),
                "rag_status": "GREEN",
            }
        )
