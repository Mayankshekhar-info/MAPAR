import time
from django.core.management.base import BaseCommand
from django.db import connections
from django.db.utils import OperationalError


class Command(BaseCommand):
    """Django command to pause execution until database is available."""

    help = "Wait for database connection to be available"

    def add_arguments(self, parser):
        parser.add_argument(
            "--timeout",
            type=int,
            default=30,
            help="Maximum seconds to wait for database connection (default: 30)",
        )

    def handle(self, *args, **options):
        timeout = options.get("timeout", 30)
        self.stdout.write("Waiting for database connection...")
        db_conn = None
        attempts = 0
        start_time = time.time()
        while attempts < timeout:
            try:
                db_conn = connections["default"]
                with db_conn.cursor() as cursor:
                    cursor.execute("SELECT 1;")
                self.stdout.write(self.style.SUCCESS("Database is available and ready!"))
                return
            except OperationalError as e:
                attempts = int(time.time() - start_time)
                self.stdout.write(f"Database unavailable ({e}), waiting 1 second... ({attempts}/{timeout}s)")
                time.sleep(1)

        self.stderr.write(self.style.ERROR("Database connection timed out."))
        raise SystemExit(1)
