from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='Circle',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=150)),
                ('code', models.CharField(db_index=True, max_length=50)),
                ('region', models.CharField(blank=True, default='North', max_length=50)),
                ('head_name', models.CharField(blank=True, default='', max_length=100)),
                ('head_email', models.CharField(blank=True, default='', max_length=100)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Circle',
                'verbose_name_plural': 'Circles',
                'db_table': 'organization_circle',
                'ordering': ['name'],
            },
        ),
        migrations.CreateModel(
            name='Domain',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=150)),
                ('code', models.CharField(db_index=True, max_length=50)),
                ('description', models.TextField(blank=True, default='')),
                ('icon', models.CharField(default='layers', max_length=50)),
                ('color', models.CharField(default='blue', max_length=20)),
                ('display_order', models.IntegerField(default=0)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Domain',
                'verbose_name_plural': 'Domains',
                'db_table': 'organization_domain',
                'ordering': ['display_order', 'name'],
            },
        ),
    ]
