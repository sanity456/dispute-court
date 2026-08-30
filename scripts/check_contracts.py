"""Safe, project-local contract validation. Never sends transactions."""
import argparse
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
EXPECTED_RUNNER = 'py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--legacy", action="store_true", help="Also run historical direct-mode tests")
    args = parser.parse_args()
    if sys.version_info[:2] != (3, 12):
        parser.error("Use Python 3.12 with requirements-dev.txt.")
    lint = Path(sys.executable).with_name("genvm-lint.exe" if os.name == "nt" else "genvm-lint")
    if not lint.is_file():
        parser.error("Install requirements-dev.txt into this Python environment first.")
    environment = os.environ.copy()
    environment["PYTEST_DISABLE_PLUGIN_AUTOLOAD"] = "1"
    environment["RUN_GENLAYER_INTEGRATION"] = "0"
    environment["RUN_GENLAYER_V3_INTEGRATION"] = "0"
    for name in ["dispute_court_v3.py", "evidence_capture_v3.py"]:
        path = ROOT / "contracts" / name
        if EXPECTED_RUNNER not in path.read_text(encoding="utf-8").splitlines()[0]:
            parser.error("Unexpected runner pin: " + name)
        subprocess.run([str(lint), "check", str(path), "--json"], cwd=ROOT, env=environment, check=True)
    selected = ["tests"] if args.legacy else [
        "tests/test_dispute_court_v3.py", "tests/test_security_court_v3.py", "tests/test_evidence_capture_v3.py",
    ]
    subprocess.run(
        [sys.executable, "-m", "pytest", "-p", "gltest.direct.pytest_plugin",
         "-p", "no:cacheprovider", "-m", "not integration", *selected, "-q", "--tb=short", "-rs"],
        cwd=ROOT, env=environment, check=True,
    )


if __name__ == "__main__":
    main()
