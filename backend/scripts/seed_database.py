import os
import sys
import argparse
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
from apps.authorization.models import (
    AccessModule,
    AccessPermissionAction,
    AccessPermission,
    AccessRole,
    AccessRolePermission,
    AccessUserRole,
)


def ensure_unmanaged_tables():
    """
    Ensure the externally managed / legacy cockpit tables exist in PostgreSQL
    with correct constraints, foreign keys, and indexes.
    """
    print("Ensuring unmanaged legacy tables and indexes exist in PostgreSQL...")
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
            CREATE INDEX IF NOT EXISTS idx_reportingperiod_current ON organization_reportingperiod(is_current);
            CREATE INDEX IF NOT EXISTS idx_reportingperiod_dates ON organization_reportingperiod(start_date, end_date);
        """)
        cursor.execute("""
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
            CREATE INDEX IF NOT EXISTS idx_kpi_domain ON kpis_kpi(domain_id);
            CREATE INDEX IF NOT EXISTS idx_kpi_active ON kpis_kpi(is_active);
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
            CREATE INDEX IF NOT EXISTS idx_kpivalue_circle_period ON kpis_kpivalue(circle_id, period_id);
            CREATE INDEX IF NOT EXISTS idx_kpivalue_rag ON kpis_kpivalue(rag_status);
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
            CREATE INDEX IF NOT EXISTS idx_gov_issue_circle ON governance_issue(circle_id);
            CREATE INDEX IF NOT EXISTS idx_gov_issue_status ON governance_issue(status);
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
            CREATE INDEX IF NOT EXISTS idx_gov_action_circle ON governance_actionitem(circle_id);
            CREATE INDEX IF NOT EXISTS idx_gov_action_status ON governance_actionitem(status);
        """)


def seed_master_data():
    """
    Seed required baseline master data:
    - Super Administrator account
    - Baseline enterprise hierarchy (MainCompany, SubCompany, Project, Circles, Domains)
    - Active and standard reporting periods
    - Access modules, actions, and permissions
    - Enterprise roles and role permissions
    - Role binding for Super Administrator
    """
    ensure_unmanaged_tables()

    print("Provisioning system administrator...")
    admin_password = os.environ.get("INITIAL_ADMIN_PASSWORD", "admin123")
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
    if created:
        admin.set_password(admin_password)
        admin.save()
        print("Initial Super Administrator account created successfully.")
    else:
        print("Super Administrator account already exists.")

    print("Seeding base organization hierarchy...")
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

    print("Seeding standard reporting periods...")
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

    print("Seeding authorization modules, actions, and permissions...")
    actions_meta = [
        ("view", "View", "Read-only access to records and views", 1),
        ("create", "Create", "Permission to add new records", 2),
        ("edit", "Edit", "Permission to modify existing records", 3),
        ("delete", "Delete", "Permission to delete or deactivate records", 4),
        ("export", "Export", "Permission to export operational data to CSV/Excel", 5),
        ("manage", "Manage", "Full administrative control of module", 6),
    ]
    action_objs = {}
    for code, name, desc, sort in actions_meta:
        act, _ = AccessPermissionAction.objects.get_or_create(
            code=code,
            defaults={"name": name, "description": desc, "sort_order": sort, "is_active": True}
        )
        action_objs[code] = act

    modules_meta = [
        ("management", "Management Cockpit", "Executive scorecard & cross-domain operational intelligence", 1),
        ("slides", "Slide View", "8-tier hierarchy drilldown & deck view", 2),
        ("organization", "Organization Hierarchy", "Corporate entities, circles, domains, and departments", 3),
        ("uploads", "Uploads & Imports", "Data templates, validation engines, and ingestion history", 4),
        ("kpi", "Universal KPI Registry", "Dynamic KPI definitions, formulas, and evaluation rules", 5),
        ("users", "User Administration", "Enterprise user accounts and lifecycle management", 6),
        ("admin", "System Administration", "Security roles, permission matrices, and access scopes", 7),
    ]
    module_objs = {}
    for code, name, desc, sort in modules_meta:
        mod, _ = AccessModule.objects.get_or_create(
            code=code,
            defaults={"name": name, "description": desc, "sort_order": sort, "is_active": True}
        )
        module_objs[code] = mod

    permissions_map = {}
    for mod_code, mod_obj in module_objs.items():
        if mod_code in ["management", "slides"]:
            allowed_actions = ["view", "export"]
        elif mod_code in ["organization", "kpi", "users", "admin"]:
            allowed_actions = ["view", "create", "edit", "delete", "export"]
        elif mod_code == "uploads":
            allowed_actions = ["view", "create", "edit", "delete", "export", "manage"]
        else:
            allowed_actions = ["view"]

        for act_code in allowed_actions:
            perm_code = f"{mod_code}.{act_code}"
            perm, _ = AccessPermission.objects.get_or_create(
                code=perm_code,
                defaults={
                    "name": f"{action_objs[act_code].name} {mod_obj.name}",
                    "module": mod_obj,
                    "action": action_objs[act_code],
                    "risk_level": "HIGH" if act_code in ["delete", "manage"] else "LOW",
                    "is_active": True,
                }
            )
            permissions_map[perm_code] = perm

    print("Seeding baseline enterprise roles...")
    roles_meta = [
        ("SUPER_ADMIN", "Super Administrator", "Full unrestricted enterprise access to all platform capabilities", "SYSTEM", "CRITICAL"),
        ("EXECUTIVE", "Executive Leadership", "Cross-tier performance visibility, reporting, and operational export rights", "SYSTEM", "MEDIUM"),
        ("REGIONAL_DIRECTOR", "Regional Director", "Performance review and upload tracking across regional circle boundaries", "SYSTEM", "MEDIUM"),
        ("CIRCLE_HEAD", "Circle Operations Head", "Operational data monitoring, imports, and KPI tracking within circle scope", "SYSTEM", "MEDIUM"),
        ("OPERATIONS_LEAD", "Operations Team Lead", "Operational data ingestion and metric review", "CUSTOM", "LOW"),
        ("VIEWER", "Enterprise Viewer", "Read-only access to operational dashboards and slide decks", "SYSTEM", "LOW"),
    ]
    created_roles = {}
    for code, name, desc, r_type, risk in roles_meta:
        role, _ = AccessRole.objects.get_or_create(
            code=code,
            defaults={
                "name": name,
                "description": desc,
                "role_type": r_type,
                "risk_level": risk,
                "status": "ACTIVE",
            }
        )
        created_roles[code] = role

    all_perm_objs = list(permissions_map.values())
    for p in all_perm_objs:
        AccessRolePermission.objects.get_or_create(role=created_roles["SUPER_ADMIN"], permission=p, defaults={"is_denied": False})

    for p in all_perm_objs:
        if p.action and p.action.code in ["view", "export"]:
            AccessRolePermission.objects.get_or_create(role=created_roles["EXECUTIVE"], permission=p, defaults={"is_denied": False})

    for p in all_perm_objs:
        if (p.action and p.action.code in ["view", "export"]) or p.code in ["uploads.create", "uploads.edit", "kpi.view"]:
            AccessRolePermission.objects.get_or_create(role=created_roles["CIRCLE_HEAD"], permission=p, defaults={"is_denied": False})

    for p in all_perm_objs:
        if p.code in ["management.view", "slides.view", "organization.view"]:
            AccessRolePermission.objects.get_or_create(role=created_roles["VIEWER"], permission=p, defaults={"is_denied": False})

    AccessUserRole.objects.get_or_create(user=admin, role=created_roles["SUPER_ADMIN"], defaults={"is_primary": True})
    print("Master data seeded successfully.")
    return circles, domains


def seed_sample_data(circles, domains):
    """
    Development/Testing only: Seeds sample KPI metrics.
    NEVER to be run in production environments.
    """
    print("Seeding sample development KPI definition and operational values...")
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
    print("Sample development KPI data seeded.")


def main():
    parser = argparse.ArgumentParser(description="Seed MAPAR database master data.")
    parser.add_argument(
        "--with-sample-data",
        action="store_true",
        help="Seed sample KPI operational records for local development/testing only.",
    )
    args = parser.parse_args()

    circles, domains = seed_master_data()

    if args.with_sample_data:
        env = os.environ.get("MAPAR_ENV", "development").lower()
        if env == "production":
            print("ERROR: Sample operational data cannot be seeded in a PRODUCTION environment.")
            sys.exit(1)
        seed_sample_data(circles, domains)


if __name__ == "__main__":
    main()
