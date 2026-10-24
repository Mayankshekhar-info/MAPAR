# MAPAR-v2 — Architectural & Modular Compliance Contract

This document codifies the permanent architectural rules, modular file structure standards, and development protocols for the MAPAR-v2 codebase.

---

## 1. Core Principles

1. **Native MAPAR Architecture**: Every module must follow existing MAPAR patterns, data flows, scoped authorization, API conventions, and testing practices.
2. **No Parallel Architectures**: Never bypass existing patterns (e.g. Page → Hook → Service → API Client).
3. **Analyze Before Coding**: Always discover the closest existing module, inspect its structure, and define boundaries before creating or editing files.
4. **Single Responsibility & No Over-Fragmentation**:
   - Each file has one clear responsibility.
   - Do not create unneeded or empty folders. Keep modularity practical and lean.
5. **No Hard-Coded Business Data & No Fake Production Data**:
   - Never hardcode companies, circles, domains, users, roles, permissions, or KPIs.
   - All dynamic data must come through authorized database/API channels.

---

## 2. Layer & Responsibility Rules

### Frontend
- **Page (`pages/`)**: Lean composition container coordinating header, filters, main tables/cards, and detail drawers. Contains no direct API queries, complex business math, or table cell formatting.
- **Components (`components/`)**: Presentational UI components. No direct DB logic, Axios calls, or complex authorization engines inside UI blocks.
- **Hooks (`hooks/`)**: Owns stateful frontend logic, TanStack queries, mutations, debounced filtering, and table selections.
- **Services (`services/`)**: Encapsulates API communication using the existing centralized Axios instance (`services/api.ts`).
- **Types (`types/`)**: Feature-specific TypeScript interfaces and DTOs.
- **Validation (`validation/` or `schemas/`)**: Zod / React Hook Form schemas aligned with backend contracts.
- **State Management**: TanStack Query for server state; Zustand for local global state if required. Never introduce unapproved state libraries.
- **Design System**: Material-UI (MUI) components, design tokens, and existing theme conventions (`app/theme/theme.ts`).

### Backend (Django REST Framework)
- **Models (`models/`)**: Separated by sub-domain concern, with canonical re-exports in `models/__init__.py` to preserve migration and import compatibility.
- **Selectors (`selectors/`)**: Dedicated database read/retrieval queries. Avoid duplicating queryset logic across views and services.
- **Services (`services/`)**: Business logic and transactional operations wrapped in atomic transactions (`common/database/transactions.py`).
- **Serializers (`api/serializers/`)**: Validation at API boundary, serialization, and response formatting only.
- **Views (`api/views/`)**: Thin coordination layer (Authentication → Scoped Authorization → Serializer → Service/Selector → HTTP Response).
- **Permissions (`permissions/`)**: Dynamic, organization-scoped authorization delegating to centralized evaluator (`common/permissions/authorization.py`).

---

## 3. Mandatory Protocol for New Modules / Features

Before writing any new feature or module code, the following analysis must be presented:

```text
---------------------------------------------------------------
NEW MODULE ANALYSIS
---------------------------------------------------------------
MODULE NAME:
PURPOSE:
CLOSEST EXISTING MODULE:
WHY:
EXISTING PATTERN TO FOLLOW:
FRONTEND LOCATION:
BACKEND LOCATION:
DATABASE ENTITIES:
API ENDPOINTS:
SERVICES TO REUSE:
SERVICES TO CREATE:
HOOKS TO REUSE:
HOOKS TO CREATE:
SHARED COMPONENTS TO REUSE:
NEW COMPONENTS:
AUTHORIZATION:
ORGANIZATION SCOPE:
AUDIT REQUIREMENT:
WORKFLOW REQUIREMENT:
NOTIFICATION REQUIREMENT:
TESTS:
DEPENDENCIES:
FILES TO CREATE:
FILES TO MODIFY:
FILES THAT MUST NOT BE MODIFIED:
```
