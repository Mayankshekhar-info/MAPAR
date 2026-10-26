import os
from pathlib import Path
from django.core.management.base import BaseCommand
from django.core.files.storage import default_storage
from django.conf import settings
from apps.governance.models import GovernanceEvidence


class Command(BaseCommand):
    help = "Verifies the integrity of centralized governance evidence files, detecting broken links and orphaned storage files."

    def add_arguments(self, parser):
        parser.add_argument(
            "--cleanup-orphans",
            action="store_true",
            help="Safely remove orphaned files from centralized storage that have no corresponding database record.",
        )

    def handle(self, *args, **options):
        cleanup_orphans = options.get("cleanup_orphans", False)

        self.stdout.write(self.style.NOTICE("Starting Governance Evidence Integrity Audit..."))

        total_db_records = GovernanceEvidence.objects.count()
        valid_records = 0
        missing_files = []
        referenced_storage_paths = set()

        for ev in GovernanceEvidence.objects.select_related("action_point").iterator():
            if not ev.file or not ev.file.name:
                missing_files.append({
                    "id": ev.id,
                    "action_id": ev.action_point.action_id if ev.action_point else "N/A",
                    "file_name": ev.file_name,
                    "error": "No file path defined on model",
                })
                continue

            storage_rel_path = ev.file.name
            referenced_storage_paths.add(storage_rel_path)

            if not ev.file.storage.exists(storage_rel_path):
                missing_files.append({
                    "id": ev.id,
                    "action_id": ev.action_point.action_id if ev.action_point else "N/A",
                    "file_name": ev.file_name,
                    "storage_path": storage_rel_path,
                    "error": "File does not exist in storage provider",
                })
            else:
                valid_records += 1

        self.stdout.write(f"Total Evidence Records in DB: {total_db_records}")
        self.stdout.write(self.style.SUCCESS(f"Valid & Confirmed Files in Storage: {valid_records}"))

        if missing_files:
            self.stdout.write(self.style.ERROR(f"Broken / Missing Evidence References: {len(missing_files)}"))
            for m in missing_files:
                self.stdout.write(f"  - Evidence #{m['id']} (Task: {m['action_id']}): {m['file_name']} -> {m['error']}")
        else:
            self.stdout.write(self.style.SUCCESS("Zero broken evidence database references found!"))

        # Inspect storage for orphaned files under governance/evidence/
        orphaned_files = []
        evidence_storage_dir = Path(settings.MEDIA_ROOT) / "governance" / "evidence"

        if evidence_storage_dir.exists():
            for root, _, files in os.walk(evidence_storage_dir):
                for f in files:
                    full_p = Path(root) / f
                    rel_p = str(full_p.relative_to(settings.MEDIA_ROOT)).replace("\\", "/")
                    if rel_p not in referenced_storage_paths:
                        orphaned_files.append(rel_p)

        self.stdout.write(f"Orphaned Storage Files (not referenced in DB): {len(orphaned_files)}")

        if orphaned_files:
            if cleanup_orphans:
                self.stdout.write(self.style.WARNING(f"Cleaning up {len(orphaned_files)} orphaned storage files..."))
                cleaned = 0
                for orphan_rel in orphaned_files:
                    try:
                        if default_storage.exists(orphan_rel):
                            default_storage.delete(orphan_rel)
                            cleaned += 1
                    except Exception as e:
                        self.stdout.write(self.style.ERROR(f"  Failed to delete {orphan_rel}: {e}"))
                self.stdout.write(self.style.SUCCESS(f"Cleaned up {cleaned} orphaned files."))
            else:
                self.stdout.write("  (Use --cleanup-orphans to remove unreferenced files from storage)")

        self.stdout.write(self.style.SUCCESS("Evidence Integrity Audit Complete."))
