#!/usr/bin/env python3
"""Standalone helper to run anonymization of soft-deleted users.

Intended to be invoked from cron/CI: python scripts/anonymize_old_users.py --days 30
"""

from __future__ import annotations

import argparse
from src.app import create_app

parser = argparse.ArgumentParser(description="Run anonymization for soft-deleted users")
parser.add_argument(
    "--days", type=int, default=None, help="Override retention days (default: config)"
)
args = parser.parse_args()

app = create_app("production")
with app.app_context():
    from src.app.auth import services

    days = (
        args.days
        if args.days is not None
        else app.config.get("AUTH_ACCOUNT_ANONYMIZE_AFTER_DAYS", 30)
    )
    count = services.anonymize_soft_deleted_users_older_than(days)
    print(f"Anonymized {count} users (older than {days} days)")
