from fastapi import APIRouter

from app.api.routes import auth, billing, catalog, health, integrations, receipts, reports, support, uploads

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(billing.router, prefix="/billing", tags=["billing"])
api_router.include_router(uploads.router, prefix="/uploads", tags=["uploads"])
api_router.include_router(receipts.router, prefix="/receipts", tags=["receipts"])
api_router.include_router(catalog.router)
api_router.include_router(integrations.router, prefix="/integrations", tags=["integrations"])
api_router.include_router(reports.router, prefix="/reports", tags=["reports"])
api_router.include_router(support.router, prefix="/support", tags=["support"])
