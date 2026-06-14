"""Idempotent demo bootstrap for deployment.

Runs on every container start, so it must be safe to run repeatedly:
  * seed_demo uses get_or_create (safe to repeat),
  * the CSV is imported ONLY if the group has no expenses yet, so redeploys
    never create duplicate expenses.
"""

from django.core.management import call_command
from django.core.management.base import BaseCommand

from expenses.models import Expense
from groups.models import Group
from importer import services


class Command(BaseCommand):
    help = "Seed demo data and import the CSV once (idempotent)."

    def handle(self, *args, **options):
        call_command("seed_demo")
        group = Group.objects.order_by("id").first()
        if group is None:
            return

        if Expense.objects.filter(group=group).exists():
            self.stdout.write("Expenses already present — skipping CSV import.")
            return

        from django.conf import settings
        csv_path = settings.BASE_DIR.parent / "data" / "expenses_export.csv"
        if not csv_path.exists():
            self.stdout.write(self.style.WARNING(f"CSV not found at {csv_path}; skipping."))
            return

        batch = services.stage_csv(group, csv_path.read_bytes(), csv_path.name, user=group.owner)
        result = services.commit_batch(batch, user=group.owner, auto_approve=True)
        self.stdout.write(self.style.SUCCESS(f"Imported demo CSV: {result}"))
