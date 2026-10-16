from django.db import migrations


EXACT_COLUMNS = [
    (1, "sl", "SL", "INTEGER"),
    (2, "entity", "Entity", "TEXT"),
    (3, "site_type", "Site Type", "TEXT"),
    (4, "circle_name", "Circle Name", "REFERENCE"),
    (5, "bsnl_site_id", "BSNL Site ID", "TEXT"),
    (6, "site_name_village_name", "Site Name/Village Name", "TEXT"),
    (7, "ba", "BA", "TEXT"),
    (8, "oa", "OA", "TEXT"),
    (9, "district", "District", "TEXT"),
    (10, "site_commissioning_hoto_status", "Site Commissioning /Hoto Status", "TEXT"),
    (11, "om_status", "O&M Status", "TEXT"),
    (12, "eb_status", "EB Status", "TEXT"),
    (13, "dg_status", "DG Status", "TEXT"),
    (14, "site_on_air_status", "Site On Air Status", "TEXT"),
    (15, "ie_name", "IE Name", "TEXT"),
    (16, "ci_name", "CI Name", "TEXT"),
    (17, "om_name", "O&M Name", "TEXT"),
    (18, "cbh_name", "CBH Name", "TEXT"),
    (19, "outage_min", "Outage min", "DECIMAL"),
    (20, "uptime", "Uptime", "PERCENTAGE"),
]


def create_or_update_template_columns(apps, schema_editor):
    UploadTemplate = apps.get_model("imports", "UploadTemplate")
    UploadTemplateVersion = apps.get_model("imports", "UploadTemplateVersion")
    UploadTemplateColumn = apps.get_model("imports", "UploadTemplateColumn")

    # 1. Primary Dedicated Template: 'Upload Excel Template'
    tpl, _ = UploadTemplate.objects.get_or_create(
        code="UPLOAD_EXCEL_TEMPLATE",
        defaults={
            "name": "Upload Excel Template",
            "description": "[CLEAN_TEMPLATE] Upload Excel template containing exactly 20 site operations columns.",
            "data_level": "CIRCLE",
            "status": "ACTIVE",
            "target_entity": "OPERATIONS",
        }
    )
    tpl.description = "[CLEAN_TEMPLATE] Upload Excel template containing exactly 20 site operations columns."
    tpl.save()

    v1, _ = UploadTemplateVersion.objects.get_or_create(
        template=tpl,
        version_number=1,
        defaults={"changelog": "Initial 20-column clean template", "is_active": True}
    )
    v1.is_active = True
    v1.save()

    # Clear any mismatched columns on v1 and populate exact 20 columns
    UploadTemplateColumn.objects.filter(version=v1).delete()
    cols_to_create = [
        UploadTemplateColumn(
            version=v1,
            column_order=order,
            name=name,
            display_label=label,
            data_type=dtype,
            is_required=False,
            is_unique=False,
            default_value="",
            description="",
            validation_rules={},
        )
        for order, name, label, dtype in EXACT_COLUMNS
    ]
    UploadTemplateColumn.objects.bulk_create(cols_to_create)

    # 2. Also align existing 'BSNL_SITE_DETAILS' template to exact 20 columns
    bsnl_tpl = UploadTemplate.objects.filter(code="BSNL_SITE_DETAILS").first()
    if bsnl_tpl:
        bsnl_tpl.description = "[CLEAN_TEMPLATE] Upload Excel template containing exactly 20 site operations columns."
        bsnl_tpl.save()
        bsnl_v = UploadTemplateVersion.objects.filter(template=bsnl_tpl, is_active=True).first()
        if not bsnl_v:
            bsnl_v, _ = UploadTemplateVersion.objects.get_or_create(
                template=bsnl_tpl,
                version_number=1,
                defaults={"changelog": "Exact 20 columns", "is_active": True}
            )
        UploadTemplateColumn.objects.filter(version=bsnl_v).delete()
        bsnl_cols = [
            UploadTemplateColumn(
                version=bsnl_v,
                column_order=order,
                name=name,
                display_label=label,
                data_type=dtype,
                is_required=False,
                is_unique=False,
                default_value="",
                description="",
                validation_rules={},
            )
            for order, name, label, dtype in EXACT_COLUMNS
        ]
        UploadTemplateColumn.objects.bulk_create(bsnl_cols)


def remove_template_columns(apps, schema_editor):
    UploadTemplate = apps.get_model("imports", "UploadTemplate")
    UploadTemplate.objects.filter(code="UPLOAD_EXCEL_TEMPLATE").delete()


class Migration(migrations.Migration):

    dependencies = [
        ('imports', '0005_alter_importstagedrow_raw_data_and_more'),
    ]

    operations = [
        migrations.RunPython(create_or_update_template_columns, remove_template_columns),
    ]
