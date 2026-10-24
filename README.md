# MAPAR

Enterprise modular business management platform.

## Architecture

MAPAR uses a modular monolith architecture:

- Backend: Python + Django + Django REST Framework
- Frontend: React + TypeScript + Material UI
- Database: PostgreSQL
- Cache/Broker: Redis
- Background Jobs: Celery
- Reverse Proxy: Nginx

## Core Architecture Principles

1. Modular domain boundaries
2. Centralized authorization
3. RBAC + organization scope
4. Resource-level authorization
5. Separation of Duties
6. Transactional business operations
7. API versioning
8. Immutable audit strategy
9. Secure configuration
10. Automated testing
11. CI/CD
12. Observability

## Important

Do not put production secrets into source control.

Do not bypass the centralized authorization service.

Do not put complex business logic inside Django views or model save methods.
