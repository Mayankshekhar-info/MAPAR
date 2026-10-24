# Documents Services

Application/domain services belong here.

Rules:

- Keep business logic out of API views.
- Keep complex business logic out of model `save()`.
- Use `transaction.atomic()` for transactional operations.
- Authorization must be enforced before mutations.
- Services should be independently testable.
