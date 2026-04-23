from app.core.config import settings
from app.db.session import engine
from app.models import Base


def bootstrap_database() -> None:
    if not settings.app_auto_create_schema:
        return
    Base.metadata.create_all(bind=engine)

