from enum import Enum


class CategorySource(str, Enum):
    SYSTEM = "system"
    USER = "user"
    QUICKBOOKS = "quickbooks"


class IntegrationProvider(str, Enum):
    QUICKBOOKS = "quickbooks"
    MICROSOFT = "microsoft"


class IntegrationStatus(str, Enum):
    NOT_CONNECTED = "not_connected"
    CONNECTED = "connected"
    EXPIRED = "expired"
    REVOKED = "revoked"
    ERROR = "error"


class ReceiptSource(str, Enum):
    CAMERA = "camera"
    UPLOAD = "upload"
    EMAIL = "email"
    API = "api"


class ReceiptStatus(str, Enum):
    UPLOADED = "uploaded"
    PROCESSING = "processing"
    REVIEW_REQUIRED = "review_required"
    APPROVED = "approved"
    SYNCING = "syncing"
    SYNCED = "synced"
    FAILED = "failed"
    ARCHIVED = "archived"


class SyncTarget(str, Enum):
    QUICKBOOKS = "quickbooks"
    EXCEL = "excel"


class SyncStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    NEEDS_REAUTH = "needs_reauth"


class VersionSource(str, Enum):
    OCR = "ocr"
    LLM = "llm"
    USER = "user"


class BillingProvider(str, Enum):
    REVENUECAT = "revenuecat"


class EntitlementStatus(str, Enum):
    TRIALING = "trialing"
    ACTIVE = "active"
    GRACE_PERIOD = "grace_period"
    EXPIRED = "expired"
    CANCELED = "canceled"


class DevicePlatform(str, Enum):
    IOS = "ios"
    ANDROID = "android"
    WEB = "web"


class SupportTicketPriority(str, Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


class SupportTicketStatus(str, Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    CLOSED = "closed"
