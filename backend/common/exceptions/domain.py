class DomainError(Exception):
    """Base class for MAPAR business/domain exceptions."""


class BusinessRuleViolation(DomainError):
    pass


class InvalidStateTransition(DomainError):
    pass


class ScopeViolation(DomainError):
    pass
