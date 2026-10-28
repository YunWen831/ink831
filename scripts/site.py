#!/usr/bin/env python3
"""Preview, publish, and verify the YunWen static site using Python's stdlib."""

import argparse
import functools
import html
import http.server
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time
from urllib.parse import urlencode, urljoin, urlsplit
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
REPOSITORY = "YunWen831/ink831"
SITE = "https://ink831.dpdns.org/"
DEFAULT_PATHS = (
    "/", "/software/", "/games/", "/tools/",
    "/assets/home.css", "/assets/portal.css", "/assets/home.js",
)
REDIRECTS = (
    "http://ink831.dpdns.org/",
    "https://www.ink831.dpdns.org/",
    "https://yunwen831.github.io/ink831/",
)


def git(*args, capture=True):
    environment = os.environ.copy()
    environment.update(GIT_TERMINAL_PROMPT="0", GCM_INTERACTIVE="never")
    result = subprocess.run(
        ["git", "-C", str(ROOT), *args], check=True,
        capture_output=capture, text=True, encoding="utf-8", env=environment,
    )
    return result.stdout.strip() if capture else ""


def require_repository():
    remote = git("remote", "get-url", "origin")
    normalized = remote.rstrip("/").removesuffix(".git").lower()
    allowed = {
        "https://github.com/yunwen831/ink831",
        "git@github.com:yunwen831/ink831",
        "ssh://git@github.com/yunwen831/ink831",
    }
    if normalized not in allowed:
        raise RuntimeError(f"Wrong origin for this helper: {remote}")
    return remote


def status():
    remote = require_repository()
    print(f"Checkout: {ROOT}\nOrigin: {remote}\nLive site: {SITE}")
    print(git("status", "--short", "--branch"))
    print(f"Local HEAD: {git('rev-parse', 'HEAD')}")
    print("No fetch performed; remote-tracking references may be stale.")


def preview(port):
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)
    print(f"Preview: http://127.0.0.1:{port}/ (Ctrl+C to stop)", flush=True)
    try:
        server.serve_forever()
    finally:
        server.server_close()


def request(url):
    return urlopen(Request(url, headers={"User-Agent": "YunWen-site-helper"}), timeout=15)


def wait_for_pages(sha, wait):
    if not re.fullmatch(r"[0-9a-fA-F]{40}", sha):
        raise ValueError("--sha must be the full 40-character commit SHA")
    query = urlencode({"head_sha": sha, "per_page": 30})
    api = f"https://api.github.com/repos/{REPOSITORY}/actions/runs?{query}"
    deadline = time.monotonic() + wait
    previous_state = None
    while True:
        with request(api) as response:
            runs = json.load(response)["workflow_runs"]
        pages_runs = [
            run for run in runs
            if run.get("head_sha", "").lower() == sha.lower()
            and (run.get("name") == "pages build and deployment"
                 or run.get("path", "").startswith("dynamic/pages/"))
        ]
        latest = max(pages_runs, key=lambda run: run["id"], default=None)
        current_state = (
            f"{latest['status']} / {latest.get('conclusion') or 'pending'}"
            if latest else "waiting for a Pages run"
        )
        if current_state != previous_state:
            print(f"Pages {sha[:12]}: {current_state}", flush=True)
            previous_state = current_state
        if latest and latest["status"] == "completed":
            if latest.get("conclusion") != "success":
                raise RuntimeError(f"Pages deployment failed: {latest['html_url']}")
            print(f"Deployment: {latest['html_url']}")
            return
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError(f"Deployment not confirmed within {wait}s: {sha}")
        time.sleep(min(10, remaining))


def verify(base_url, paths, sha=None, wait=300):
    base_url = base_url.rstrip("/") + "/"
    base = urlsplit(base_url)
    if base.scheme not in {"http", "https"} or not base.hostname or base.username or base.password:
        raise ValueError("Use an HTTP(S) base URL without embedded credentials")
    if base.query or base.fragment or base.path != "/":
        raise ValueError("--base-url must be the site's origin, without a path/query/fragment")
    if base.scheme == "http" and base.hostname not in {"127.0.0.1", "localhost", "::1"}:
        raise ValueError("Use HTTPS for a remote site; HTTP is only allowed for local preview")
    if sha:
        if base_url != SITE:
            raise ValueError("Commit deployment checks apply to the production site only")
        wait_for_pages(sha, wait)
    errors = []
    for path in dict.fromkeys((*DEFAULT_PATHS, *paths)):
        parsed = urlsplit(path)
        if parsed.scheme or parsed.netloc or not path.startswith("/"):
            raise ValueError(f"Use a site-relative --path, such as /tools/new-tool/: {path}")
        url = urljoin(base_url, path.lstrip("/"))
        try:
            with request(url) as response:
                final_url = response.geturl()
                if response.status != 200:
                    raise RuntimeError(f"HTTP {response.status}")
                final = urlsplit(final_url)
                if (final.scheme, final.netloc, final.path.rstrip("/")) != (
                    base.scheme, base.netloc, parsed.path.rstrip("/")
                ):
                    raise RuntimeError(f"Unexpected redirect: {final_url}")
                body = response.read(1024 * 1024).decode("utf-8", errors="replace")
                match = re.search(r"<title\b[^>]*>(.*?)</title>", body, re.I | re.S)
                title = html.unescape(match.group(1)).strip() if match else ""
                print(f"OK 200 {url}" + (f" [{title}]" if title else ""), flush=True)
        except Exception as error:
            errors.append(f"{url}: {error}")
            print(f"FAIL {errors[-1]}", flush=True)
    if base_url == SITE:
        for url in REDIRECTS:
            try:
                with request(url) as response:
                    if response.status != 200 or response.geturl() != SITE:
                        raise RuntimeError(f"Expected {SITE}, got {response.geturl()}")
                    print(f"OK redirect {url} -> {SITE}", flush=True)
            except Exception as error:
                errors.append(f"{url}: {error}")
                print(f"FAIL {errors[-1]}", flush=True)
    if errors:
        raise RuntimeError(f"{len(errors)} website check(s) failed")
    print("HTTP checks passed. Browser interaction checks are separate.")


def deploy(wait, paths):
    require_repository()
    if git("branch", "--show-current") != "main":
        raise RuntimeError("Deploy requires the main branch; no automatic branch switching")
    if git("status", "--porcelain"):
        raise RuntimeError("Commit only the intended files first; working tree must be clean")
    git("fetch", "origin", "main", capture=False)
    behind, ahead = map(int, git("rev-list", "--left-right", "--count", "origin/main...HEAD").split())
    if behind:
        raise RuntimeError("main is behind or diverged; reconcile it without force-pushing")
    sha = git("rev-parse", "HEAD")
    if ahead:
        git("push", "origin", "main:main", capture=False)
    else:
        print("No new local commits to push; verifying current main.")
    verify(SITE, paths, sha=sha, wait=wait)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("status", help="Show the checkout, origin, branch, and working tree")
    preview_parser = commands.add_parser("preview", help="Serve this checkout on localhost")
    preview_parser.add_argument("--port", type=int, default=4173)
    verify_parser = commands.add_parser("verify", help="Verify website HTTP access and optional deployment")
    verify_parser.add_argument("--base-url", default=SITE)
    verify_parser.add_argument("--sha", help="Full commit SHA whose Pages deployment must succeed")
    verify_parser.add_argument("--path", action="append", default=[])
    verify_parser.add_argument("--wait", type=int, default=300)
    deploy_parser = commands.add_parser("deploy", help="Push committed main and verify its Pages deployment")
    deploy_parser.add_argument("--path", action="append", default=[])
    deploy_parser.add_argument("--wait", type=int, default=300)
    args = parser.parse_args()
    if hasattr(args, "wait") and args.wait < 0:
        parser.error("--wait must not be negative")
    try:
        if args.command == "status":
            status()
        elif args.command == "preview":
            preview(args.port)
        elif args.command == "verify":
            verify(args.base_url, args.path, args.sha, args.wait)
        elif args.command == "deploy":
            deploy(args.wait, args.path)
    except KeyboardInterrupt:
        return 130
    except (OSError, ValueError, KeyError, subprocess.CalledProcessError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        if isinstance(error, subprocess.CalledProcessError) and error.stderr:
            print(error.stderr.rstrip(), file=sys.stderr)
        return 1
    except RuntimeError as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
