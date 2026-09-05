"""Fail closed when a submitted runtime, dependency, action, or GenVM pin drifts."""

import json
from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]
EXPECTED_RUNNER = (
    "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6"
)


def require(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(message)


requirements = [
    line.strip()
    for line in (ROOT / "requirements-dev.txt").read_text(encoding="utf-8").splitlines()
    if line.strip() and not line.lstrip().startswith("#")
]
require(requirements, "requirements-dev.txt is empty")
for requirement in requirements:
    require(
        re.fullmatch(r"[A-Za-z0-9_.-]+(?:\[[A-Za-z0-9_,.-]+\])?==[A-Za-z0-9_.+-]+", requirement)
        is not None,
        "Unpinned Python requirement: " + requirement,
    )

package = json.loads((ROOT / "frontend/package.json").read_text(encoding="utf-8"))
require(package.get("packageManager") == "pnpm@11.19.0", "Unexpected pnpm pin")
require(package.get("engines", {}).get("node") == "24.x", "Unexpected Node major")
for group in ("dependencies", "devDependencies"):
    for name, version in package.get(group, {}).items():
        require(
            re.fullmatch(r"[0-9]+(?:\.[0-9]+)+(?:-[0-9A-Za-z.-]+)?", version)
            is not None,
            f"Unpinned {group} entry: {name}={version}",
        )

for name in ("dispute_court_v3.py", "evidence_capture_v3.py"):
    first_line = (ROOT / "contracts" / name).read_text(encoding="utf-8").splitlines()[0]
    require(EXPECTED_RUNNER in first_line, "Unexpected GenVM runner pin: " + name)

workflow = (ROOT / ".github/workflows/ubuntu-clean-suite.yml").read_text(
    encoding="utf-8"
)
uses = re.findall(r"^\s*uses:\s*(\S+)", workflow, flags=re.MULTILINE)
require(uses, "No GitHub Actions found")
for action in uses:
    require(
        re.fullmatch(r"[^@\s]+@[0-9a-f]{40}", action) is not None,
        "GitHub Action is not pinned to a commit: " + action,
    )
for expected in (
    "runs-on: ubuntu-24.04",
    'python-version: "3.12.13"',
    'node-version: "24.18.0"',
    "pnpm@11.19.0",
):
    require(expected in workflow, "Missing CI runtime pin: " + expected)

print(
    json.dumps(
        {
            "passed": True,
            "pythonRequirements": len(requirements),
            "nodeDependencies": len(package["dependencies"])
            + len(package["devDependencies"]),
            "githubActions": len(uses),
            "genvmRunner": EXPECTED_RUNNER,
        },
        sort_keys=True,
    )
)
