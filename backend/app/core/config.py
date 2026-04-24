from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "development"
    app_secret_key: str = "replace-me"
    app_auto_create_schema: bool = True
    backend_cors_origins: str = "http://localhost:3000,http://localhost:3022,http://localhost:8081"
    dev_auth_enabled: bool = True
    postgres_dsn: str = "postgresql+psycopg://postgres:postgres@localhost:5432/receipt_tracker"
    redis_url: str = "redis://localhost:6379/0"
    storage_provider: str = "local"
    s3_bucket: str = "receipt-tracker-dev"
    s3_region: str = "us-east-1"
    s3_endpoint: str = ""
    s3_access_key_id: str = ""
    s3_secret_access_key: str = ""
    s3_presign_expiry_seconds: int = 900
    local_uploads_dir: str = "dev_uploads"
    dev_auth_email: str = "demo@example.com"
    dev_auth_name: str = "Demo User"
    aws_region: str = "us-east-1"
    qbo_client_id: str = ""
    qbo_client_secret: str = ""
    qbo_redirect_uri: str = ""
    qbo_base_url: str = "https://sandbox-quickbooks.api.intuit.com"
    qbo_minor_version: int = 75
    ms_client_id: str = ""
    ms_client_secret: str = ""
    ms_redirect_uri: str = ""
    ms_tenant_id: str = "common"
    ms_graph_base_url: str = "https://graph.microsoft.com/v1.0"
    supabase_url: str = ""
    supabase_jwt_audience: str = "authenticated"
    supabase_jwt_issuer: str = ""
    supabase_jwks_url: str = ""
    revenuecat_webhook_authorization: str = ""
    revenuecat_entitlement_key: str = "pro"
    default_trial_days: int = 14
    textract_enabled: bool = False
    openai_enabled: bool = False
    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"
    openai_receipt_model: str = "gpt-4o-mini"
    auto_approve_min_vendor_history: int = 3
    auto_approve_confidence_threshold: float = 0.95
    sync_run_inline: bool = True
    max_sync_attempts: int = 3
    worker_poll_seconds: int = 5
    worker_processing_batch_size: int = 25
    worker_sync_batch_size: int = 25

    @property
    def resolved_supabase_jwt_issuer(self) -> str:
        if self.supabase_jwt_issuer:
            return self.supabase_jwt_issuer
        if self.supabase_url:
            return f"{self.supabase_url}/auth/v1"
        return ""

    @property
    def resolved_supabase_jwks_url(self) -> str:
        if self.supabase_jwks_url:
            return self.supabase_jwks_url
        if self.supabase_url:
            return f"{self.supabase_url}/auth/v1/.well-known/jwks.json"
        return ""

    @property
    def resolved_backend_cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.backend_cors_origins.split(",") if origin.strip()]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


settings = Settings()
