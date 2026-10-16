from django.db import migrations


def sync_canonical_kpis(apps, schema_editor):
    # No-op: Do not auto-seed or create any KPIs automatically.
    # KPIs must only be created manually by the user or through user uploads.
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("kpi", "0001_initial"),
        ("imports", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(sync_canonical_kpis, migrations.RunPython.noop),
    ]

