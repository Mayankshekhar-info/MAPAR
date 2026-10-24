# MAPAR-v2 Architecture Compliance Rule

Permanent operational contract for any creation, extension, or modification of modules in MAPAR-v2.

1. **Follow Existing MAPAR Architecture**: Every module is an extension of the existing MAPAR system, not an independent application.
2. **Never Create Parallel Architecture**: Adhere strictly to the established data flow:
   - Frontend: `Page -> Hook -> Service -> API Client`
   - Backend: `View -> Permissions/Scope -> Serializer -> Service/Selector -> Models/Database`
3. **Analyze Before Coding**: Always run the 20-point analysis and generate the New Module Plan before modifying files.
4. **Single Responsibility**: No monolithic files mixing API, state, UI, models, or serializers.
5. **No Mock or Hard-Coded Business Data**: Pull strictly from database, API, and established services.
6. **Reuse Existing Building Blocks**: Leverage existing shared components (`frontend/src/components`), common backend database transactions (`common/database/transactions.py`), and authorization evaluators (`common/permissions/authorization.py`).
