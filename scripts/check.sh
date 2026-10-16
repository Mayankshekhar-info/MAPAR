#!/usr/bin/env bash

set -e

cd "$(dirname "$0")/../backend"

python manage.py check
python manage.py makemigrations --check
ruff check .
