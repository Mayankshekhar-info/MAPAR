import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('organization', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='MainCompany',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=200)),
                ('code', models.CharField(db_index=True, max_length=50, unique=True)),
                ('description', models.TextField(blank=True, default='')),
                ('status', models.CharField(choices=[('ACTIVE', 'Active'), ('INACTIVE', 'Inactive')], db_index=True, default='ACTIVE', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Main Company',
                'verbose_name_plural': 'Main Companies',
                'db_table': 'organization_maincompany',
                'ordering': ['name'],
            },
        ),
        migrations.CreateModel(
            name='SubCompany',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=200)),
                ('code', models.CharField(db_index=True, max_length=50)),
                ('description', models.TextField(blank=True, default='')),
                ('status', models.CharField(choices=[('ACTIVE', 'Active'), ('INACTIVE', 'Inactive')], db_index=True, default='ACTIVE', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('main_company', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='sub_companies', to='organization.maincompany')),
            ],
            options={
                'verbose_name': 'Sub Company',
                'verbose_name_plural': 'Sub Companies',
                'db_table': 'organization_subcompany',
                'ordering': ['name'],
                'unique_together': {('main_company', 'code')},
            },
        ),
        migrations.CreateModel(
            name='Project',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=200)),
                ('code', models.CharField(db_index=True, max_length=50)),
                ('description', models.TextField(blank=True, default='')),
                ('status', models.CharField(choices=[('ACTIVE', 'Active'), ('INACTIVE', 'Inactive')], db_index=True, default='ACTIVE', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('sub_company', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='projects', to='organization.subcompany')),
            ],
            options={
                'verbose_name': 'Project',
                'verbose_name_plural': 'Projects',
                'db_table': 'organization_project',
                'ordering': ['name'],
                'unique_together': {('sub_company', 'code')},
            },
        ),
        migrations.AddField(
            model_name='circle',
            name='project',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='circles', to='organization.project'),
        ),
        migrations.AddField(
            model_name='circle',
            name='status',
            field=models.CharField(choices=[('ACTIVE', 'Active'), ('INACTIVE', 'Inactive')], db_index=True, default='ACTIVE', max_length=20),
        ),
        migrations.AddField(
            model_name='domain',
            name='circle',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='domains', to='organization.circle'),
        ),
        migrations.AddField(
            model_name='domain',
            name='status',
            field=models.CharField(choices=[('ACTIVE', 'Active'), ('INACTIVE', 'Inactive')], db_index=True, default='ACTIVE', max_length=20),
        ),
        migrations.CreateModel(
            name='Department',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=150)),
                ('code', models.CharField(db_index=True, max_length=50)),
                ('description', models.TextField(blank=True, default='')),
                ('display_order', models.IntegerField(default=0)),
                ('is_active', models.BooleanField(default=True)),
                ('status', models.CharField(choices=[('ACTIVE', 'Active'), ('INACTIVE', 'Inactive')], db_index=True, default='ACTIVE', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('domain', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='departments', to='organization.domain')),
            ],
            options={
                'verbose_name': 'Department',
                'verbose_name_plural': 'Departments',
                'db_table': 'organization_department',
                'ordering': ['display_order', 'name'],
                'unique_together': {('domain', 'code')},
            },
        ),
        migrations.CreateModel(
            name='SubDepartment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=150)),
                ('code', models.CharField(db_index=True, max_length=50)),
                ('description', models.TextField(blank=True, default='')),
                ('display_order', models.IntegerField(default=0)),
                ('is_active', models.BooleanField(default=True)),
                ('status', models.CharField(choices=[('ACTIVE', 'Active'), ('INACTIVE', 'Inactive')], db_index=True, default='ACTIVE', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('department', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='sub_departments', to='organization.department')),
            ],
            options={
                'verbose_name': 'Sub Department',
                'verbose_name_plural': 'Sub Departments',
                'db_table': 'organization_subdepartment',
                'ordering': ['display_order', 'name'],
                'unique_together': {('department', 'code')},
            },
        ),
        migrations.CreateModel(
            name='HierarchyAuditLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('action', models.CharField(max_length=50)),
                ('level', models.CharField(max_length=50)),
                ('object_id', models.CharField(max_length=100)),
                ('object_repr', models.CharField(max_length=250)),
                ('details', models.JSONField(blank=True, default=dict)),
                ('timestamp', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('ip_address', models.GenericIPAddressField(blank=True, null=True)),
                ('user', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='org_audit_logs', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Hierarchy Audit Log',
                'verbose_name_plural': 'Hierarchy Audit Logs',
                'db_table': 'organization_hierarchyauditlog',
                'ordering': ['-timestamp'],
            },
        ),
    ]
