FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY backend/requirements/ /app/requirements/

RUN pip install --no-cache-dir -r /app/requirements/production.txt

COPY backend .

CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000"]
