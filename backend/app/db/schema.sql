CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'category_source') THEN
        CREATE TYPE category_source AS ENUM ('system', 'user', 'quickbooks');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'integration_provider') THEN
        CREATE TYPE integration_provider AS ENUM ('quickbooks', 'microsoft');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'integration_status') THEN
        CREATE TYPE integration_status AS ENUM ('not_connected', 'connected', 'expired', 'revoked', 'error');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'receipt_source') THEN
        CREATE TYPE receipt_source AS ENUM ('camera', 'upload', 'email', 'api');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'receipt_status') THEN
        CREATE TYPE receipt_status AS ENUM ('uploaded', 'processing', 'review_required', 'approved', 'syncing', 'synced', 'failed', 'archived');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sync_status') THEN
        CREATE TYPE sync_status AS ENUM ('queued', 'running', 'succeeded', 'failed', 'needs_reauth');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sync_target') THEN
        CREATE TYPE sync_target AS ENUM ('quickbooks', 'excel');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'version_source') THEN
        CREATE TYPE version_source AS ENUM ('ocr', 'llm', 'user');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'billing_provider') THEN
        CREATE TYPE billing_provider AS ENUM ('revenuecat');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'entitlement_status') THEN
        CREATE TYPE entitlement_status AS ENUM ('trialing', 'active', 'grace_period', 'expired', 'canceled');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'device_platform') THEN
        CREATE TYPE device_platform AS ENUM ('ios', 'android', 'web');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'support_ticket_priority') THEN
        CREATE TYPE support_ticket_priority AS ENUM ('low', 'normal', 'high', 'urgent');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'support_ticket_status') THEN
        CREATE TYPE support_ticket_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    auth_subject TEXT NOT NULL UNIQUE,
    full_name TEXT,
    company_name TEXT,
    default_currency CHAR(3) NOT NULL DEFAULT 'USD',
    timezone TEXT NOT NULL DEFAULT 'America/New_York',
    country_code CHAR(2) NOT NULL DEFAULT 'US',
    auto_approve_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    onboarding_completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    normalized_name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    receipt_count INTEGER NOT NULL DEFAULT 0,
    first_seen_at TIMESTAMPTZ,
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_vendors_user_normalized_name
    ON vendors(user_id, normalized_name);

CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    source category_source NOT NULL DEFAULT 'user',
    external_account_id TEXT,
    external_account_type TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_categories_user_name
    ON categories(user_id, name);

CREATE TABLE IF NOT EXISTS vendor_category_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    match_pattern TEXT,
    priority SMALLINT NOT NULL DEFAULT 100,
    confidence_boost NUMERIC(5, 4),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS integration_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider integration_provider NOT NULL,
    status integration_status NOT NULL DEFAULT 'not_connected',
    external_tenant_id TEXT,
    external_tenant_name TEXT,
    access_token_encrypted BYTEA,
    refresh_token_encrypted BYTEA,
    token_expires_at TIMESTAMPTZ,
    scopes TEXT[],
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_integration_connections_user_provider UNIQUE (user_id, provider)
);

CREATE TABLE IF NOT EXISTS receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    status receipt_status NOT NULL DEFAULT 'uploaded',
    source receipt_source NOT NULL DEFAULT 'camera',
    currency CHAR(3) NOT NULL DEFAULT 'USD',
    merchant_name TEXT,
    receipt_number TEXT,
    transaction_date DATE,
    payment_method TEXT,
    subtotal_amount NUMERIC(12, 2),
    tax_amount NUMERIC(12, 2),
    tip_amount NUMERIC(12, 2),
    total_amount NUMERIC(12, 2),
    notes TEXT,
    raw_ocr_text TEXT,
    ocr_provider TEXT,
    ocr_payload JSONB,
    normalized_payload JSONB,
    final_payload JSONB,
    field_confidence JSONB,
    overall_confidence NUMERIC(5, 4),
    duplicate_of_receipt_id UUID REFERENCES receipts(id) ON DELETE SET NULL,
    auto_approved_at TIMESTAMPTZ,
    processed_at TIMESTAMPTZ,
    processing_error TEXT,
    approved_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_receipts_user_id ON receipts(user_id);
CREATE INDEX IF NOT EXISTS idx_receipts_status ON receipts(status);
CREATE INDEX IF NOT EXISTS idx_receipts_transaction_date ON receipts(transaction_date);
CREATE INDEX IF NOT EXISTS idx_receipts_merchant_name ON receipts(merchant_name);

CREATE TABLE IF NOT EXISTS receipt_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id UUID NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
    object_key TEXT NOT NULL,
    original_filename TEXT,
    mime_type TEXT NOT NULL,
    file_size_bytes INTEGER,
    sha256_hash TEXT,
    page_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_receipt_files_receipt_id ON receipt_files(receipt_id);

CREATE TABLE IF NOT EXISTS receipt_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id UUID NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL DEFAULT 1,
    description TEXT NOT NULL,
    quantity NUMERIC(10, 3),
    unit_price_amount NUMERIC(12, 2),
    line_total_amount NUMERIC(12, 2),
    tax_amount NUMERIC(12, 2),
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_receipt_line_items_receipt_id ON receipt_line_items(receipt_id);

CREATE TABLE IF NOT EXISTS receipt_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id UUID NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
    source version_source NOT NULL,
    version_number INTEGER NOT NULL,
    payload JSONB NOT NULL,
    confidence_payload JSONB,
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_receipt_versions_receipt_version
    ON receipt_versions(receipt_id, version_number);

CREATE TABLE IF NOT EXISTS sync_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receipt_id UUID NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
    integration_connection_id UUID REFERENCES integration_connections(id) ON DELETE SET NULL,
    target sync_target NOT NULL,
    status sync_status NOT NULL DEFAULT 'queued',
    idempotency_key TEXT NOT NULL UNIQUE,
    external_object_id TEXT,
    request_payload JSONB,
    response_payload JSONB,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error_code TEXT,
    last_error_message TEXT,
    scheduled_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_user_id ON sync_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_receipt_id ON sync_jobs(receipt_id);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_target_status ON sync_jobs(target, status);

CREATE TABLE IF NOT EXISTS webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider integration_provider NOT NULL,
    external_event_id TEXT,
    payload JSONB NOT NULL,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_webhook_events_provider_event_id
    ON webhook_events(provider, external_event_id);

CREATE TABLE IF NOT EXISTS entitlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider billing_provider NOT NULL,
    entitlement_key TEXT NOT NULL,
    product_id TEXT,
    status entitlement_status NOT NULL DEFAULT 'trialing',
    app_user_id TEXT,
    original_app_user_id TEXT,
    store TEXT,
    starts_at TIMESTAMPTZ,
    trial_ends_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    latest_event_at TIMESTAMPTZ,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_entitlements_user_provider_key UNIQUE (user_id, provider, entitlement_key)
);
CREATE INDEX IF NOT EXISTS idx_entitlements_user_id ON entitlements(user_id);
CREATE INDEX IF NOT EXISTS idx_entitlements_app_user_id ON entitlements(app_user_id);

CREATE TABLE IF NOT EXISTS subscription_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    provider billing_provider NOT NULL,
    external_event_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    event_at TIMESTAMPTZ,
    payload JSONB NOT NULL,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_subscription_events_provider_event UNIQUE (provider, external_event_id)
);
CREATE INDEX IF NOT EXISTS idx_subscription_events_user_id ON subscription_events(user_id);

CREATE TABLE IF NOT EXISTS device_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform device_platform NOT NULL,
    device_name TEXT NOT NULL,
    app_version TEXT,
    push_token TEXT,
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_device_sessions_user_id ON device_sessions(user_id);

CREATE TABLE IF NOT EXISTS excel_workbook_bindings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    drive_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    workbook_name TEXT,
    worksheet_name TEXT,
    table_id TEXT NOT NULL,
    table_name TEXT,
    last_validated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_excel_workbook_bindings_user_id UNIQUE (user_id)
);
CREATE INDEX IF NOT EXISTS idx_excel_workbook_bindings_user_id ON excel_workbook_bindings(user_id);

CREATE TABLE IF NOT EXISTS support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receipt_id UUID REFERENCES receipts(id) ON DELETE SET NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    status support_ticket_status NOT NULL DEFAULT 'open',
    priority support_ticket_priority NOT NULL DEFAULT 'normal',
    resolution_notes TEXT,
    opened_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);
