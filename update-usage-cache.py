#!/usr/bin/env python3
"""
Background update of usage limits cache via Anthropic API (Windows version)

Credentials are retrieved from:
1. Windows Credential Manager (service: "Claude Code-credentials") - requires 'keyring' package
2. File: ~/.claude/.credentials.json (fallback for older versions or Linux/WSL)
3. Environment variable: CLAUDE_CODE_OAUTH_TOKEN
"""

import json
import os
import sys
import time
from pathlib import Path
import urllib.request
import urllib.error


def get_token_from_credential_manager() -> str:
    """
    Get OAuth token from Windows Credential Manager.
    Claude Code uses node-keytar which stores credentials as:
    - Service: "Claude Code-credentials"
    - Account: (varies, often email or user identifier)

    Returns empty string if keyring not available or credentials not found.
    """
    try:
        import keyring
    except ImportError:
        return ''

    service = "Claude Code-credentials"

    try:
        # Try to find all credentials for the service
        # keyring.get_credential returns a Credential object with username and password
        cred = keyring.get_credential(service, None)
        if cred and cred.password:
            # Password contains JSON with OAuth tokens
            try:
                data = json.loads(cred.password)
                # Structure: {"claudeAiOauth": {"accessToken": "..."}}
                if 'claudeAiOauth' in data:
                    return data['claudeAiOauth'].get('accessToken', '')
                # Direct accessToken
                if 'accessToken' in data:
                    return data['accessToken']
            except json.JSONDecodeError:
                # Password might be the token directly
                if cred.password.startswith('sk-ant-'):
                    return cred.password
    except Exception:
        pass

    return ''


def get_token_from_file() -> str:
    """
    Get OAuth token from credentials file.
    Locations checked:
    - ~/.claude/.credentials.json (Linux/WSL style)
    - ~/.claude/credentials.json (alternative)
    """
    possible_paths = [
        Path.home() / '.claude' / '.credentials.json',
        Path.home() / '.claude' / 'credentials.json',
    ]

    for cred_path in possible_paths:
        if not cred_path.exists():
            continue
        try:
            with open(cred_path, 'r', encoding='utf-8') as f:
                creds = json.load(f)

            # Structure 1: {"claudeAiOauth": {"accessToken": "..."}}
            if 'claudeAiOauth' in creds:
                token = creds['claudeAiOauth'].get('accessToken')
                if token:
                    return token

            # Structure 2: {"accessToken": "..."}
            if 'accessToken' in creds:
                return creds['accessToken']

            # Structure 3: {"oauth": {"access_token": "..."}}
            if 'oauth' in creds:
                token = creds['oauth'].get('access_token')
                if token:
                    return token

        except (json.JSONDecodeError, IOError):
            continue

    return ''


def get_token_from_env() -> str:
    """Get OAuth token from environment variable."""
    return os.environ.get('CLAUDE_CODE_OAUTH_TOKEN', '')


def get_oauth_token() -> str:
    """
    Get OAuth token trying multiple sources in order:
    1. Windows Credential Manager (primary on Windows)
    2. Credentials file (fallback, used on Linux/WSL)
    3. Environment variable
    """
    # Try Credential Manager first (Windows native)
    token = get_token_from_credential_manager()
    if token:
        return token

    # Try file-based credentials (Linux/WSL or older versions)
    token = get_token_from_file()
    if token:
        return token

    # Try environment variable
    token = get_token_from_env()
    if token:
        return token

    return ''


RATE_LIMIT_BACKOFF = 600  # 429 發生後，等 10 分鐘再試
RATELIMIT_FILE = Path.home() / '.claude' / 'usage_ratelimit'


def is_rate_limited() -> bool:
    """Check if we're still within the 429 backoff window."""
    if not RATELIMIT_FILE.exists():
        return False
    try:
        last_hit = float(RATELIMIT_FILE.read_text().strip())
        return (time.time() - last_hit) < RATE_LIMIT_BACKOFF
    except (ValueError, IOError):
        return False


def record_rate_limit():
    """Record the current time as a 429 hit."""
    try:
        RATELIMIT_FILE.write_text(str(time.time()))
    except IOError:
        pass


def clear_rate_limit():
    """Clear the backoff file after a successful call."""
    try:
        if RATELIMIT_FILE.exists():
            RATELIMIT_FILE.unlink()
    except IOError:
        pass


def fetch_usage(token: str) -> dict:
    """Fetch usage data from Anthropic API. Returns {} on failure."""
    url = 'https://api.anthropic.com/api/oauth/usage'
    headers = {
        'Authorization': f'Bearer {token}',
        'anthropic-beta': 'oauth-2025-04-20'
    }

    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            return json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        if e.code == 429:
            record_rate_limit()
        # 401 = token expired, let Claude Code CLI refresh it naturally
        return {}
    except (urllib.error.URLError, json.JSONDecodeError, TimeoutError):
        return {}


def main():
    cache_path = Path.home() / '.claude' / 'usage_cache'

    # Ensure directory exists
    cache_path.parent.mkdir(parents=True, exist_ok=True)

    # Skip if still within 429 backoff window
    if is_rate_limited():
        sys.exit(1)

    # Get token
    token = get_oauth_token()
    if not token:
        sys.exit(1)

    # Fetch usage
    response = fetch_usage(token)
    if not response:
        sys.exit(1)

    clear_rate_limit()

    # Parse response with safe fallbacks for None values
    five_hour = response.get('five_hour') or {}
    seven_day = response.get('seven_day') or {}

    h5_util = five_hour.get('utilization', 0)
    d7_util = seven_day.get('utilization', 0)
    h5_reset = five_hour.get('resets_at', '')
    d7_reset = seven_day.get('resets_at', '')

    # Round to integers
    try:
        h5_util = round(float(h5_util))
    except (ValueError, TypeError):
        h5_util = 0

    try:
        d7_util = round(float(d7_util))
    except (ValueError, TypeError):
        d7_util = 0

    # Write cache (use 'null' for empty resets to ensure 4 fields)
    h5_reset_str = h5_reset if h5_reset else 'null'
    d7_reset_str = d7_reset if d7_reset else 'null'
    cache_path.write_text(f'{h5_util} {d7_util} {h5_reset_str} {d7_reset_str}')


if __name__ == '__main__':
    main()
