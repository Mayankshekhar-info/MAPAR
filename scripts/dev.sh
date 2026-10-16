#!/usr/bin/env bash

set -e

cd "$(dirname "$0")/../backend"

python manage.py migrate

python manage.py runserver
