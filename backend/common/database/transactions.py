from contextlib import contextmanager

from django.db import transaction


@contextmanager
def atomic_operation():
    with transaction.atomic():
        yield
