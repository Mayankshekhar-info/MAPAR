from django.core.management.base import BaseCommand
from scripts.seed_database import seed_master_data, seed_sample_data
import os


class Command(BaseCommand):
    help = "Seed required MAPAR master data (roles, permissions, baseline hierarchy, reporting periods)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--with-sample-data",
            action="store_true",
            help="Seed sample KPI operational records for local development/testing only.",
        )

    def handle(self, *args, **options):
        self.stdout.write("Seeding MAPAR master data into PostgreSQL...")
        circles, domains = seed_master_data()
        self.stdout.write(self.style.SUCCESS("Master data seeded successfully."))

        if options.get("with_sample_data"):
            env = os.environ.get("MAPAR_ENV", "development").lower()
            if env == "production":
                self.stderr.write(self.style.ERROR("Sample operational data cannot be seeded in a PRODUCTION environment."))
                raise SystemExit(1)
            seed_sample_data(circles, domains)
            self.stdout.write(self.style.SUCCESS("Sample data seeded successfully."))
