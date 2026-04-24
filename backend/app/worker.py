from __future__ import annotations

import argparse
import json
import time
from typing import Sequence

from app.core.config import settings
from app.db.bootstrap import bootstrap_database
from app.db.session import SessionLocal
from app.services.worker_runner import run_worker_once


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run receipt processing and sync workers.")
    parser.add_argument("--once", action="store_true", help="Run one worker cycle and exit.")
    parser.add_argument("--poll-seconds", type=int, default=settings.worker_poll_seconds)
    parser.add_argument("--processing-limit", type=int, default=settings.worker_processing_batch_size)
    parser.add_argument("--sync-limit", type=int, default=settings.worker_sync_batch_size)
    return parser.parse_args(argv)


def run_cycle(*, processing_limit: int, sync_limit: int) -> dict[str, object]:
    with SessionLocal() as db:
        try:
            summary = run_worker_once(db, processing_limit=processing_limit, sync_limit=sync_limit)
            db.commit()
            return summary.as_dict()
        except Exception:
            db.rollback()
            raise


def main(argv: Sequence[str] | None = None) -> None:
    args = parse_args(argv)
    bootstrap_database()

    while True:
        summary = run_cycle(processing_limit=args.processing_limit, sync_limit=args.sync_limit)
        print(json.dumps(summary), flush=True)

        if args.once:
            break
        time.sleep(max(1, args.poll_seconds))


if __name__ == "__main__":
    main()
