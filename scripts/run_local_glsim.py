"""Run the pinned isolated simulator with the project's Windows fd0 workaround.

This is a native-Python simulator, not proof of GenVM or hosted-network behavior.
It binds loopback only and never loads user wallet keys or submits external writes.
"""
import os
from pathlib import Path
import runpy
import sys

ROOT = Path(__file__).resolve().parents[1]
os.environ["GENVM_VERSION"] = "v0.2.16"
if os.name == "nt":
    # The same existing shim used by the direct suite. It changes only temporary
    # stdin file lifetime, not contract execution, voting or state transitions.
    runpy.run_path(str(ROOT / "tests/conftest.py"))

from glsim.__main__ import main

sys.argv = ["glsim", "--host", "127.0.0.1", "--port", "4000", "--validators", "5",
            "--max-rotations", "5", "--no-browser", "--seed", "20260920"]
main()
