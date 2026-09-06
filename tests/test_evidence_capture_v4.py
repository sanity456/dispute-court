import hashlib
from pathlib import Path
import pytest

CONTRACT_PATH = str(Path(__file__).resolve().parents[1] / "contracts" / "evidence_capture_v4.py")
PRODUCT = "0xe1fC0258b506c6b1491db11350762D73A6fCE0A1"

def address(account):
    if isinstance(account, str):
        return account.lower()
    raw = account.as_bytes if hasattr(account, "as_bytes") else bytes(account)
    return "0x" + bytes(raw).hex()

@pytest.fixture
def capture(direct_deploy, direct_vm, direct_alice):
    direct_vm.sender = direct_alice
    direct_vm.value = 0
    direct_vm.warp("2026-08-28T00:00:00+00:00")
    return direct_deploy(CONTRACT_PATH, PRODUCT, sdk_version="v0.2.16")

def source(vm, text):
    vm.clear_mocks()
    vm.mock_web(r".*", {"status": 200, "body": text})

def test_capture_uses_exact_python_whitespace_and_full_digest(capture, direct_vm, direct_alice):
    source(direct_vm, "  First\nsecond\u0085third\u001cfourth  ")
    result = capture.capture("https://example.com/evidence", "source-1")
    expected = "First second third fourth"
    assert result["text"] == expected
    assert result["digest"] == hashlib.sha256(expected.encode()).hexdigest()
    assert result["product_contract"] == PRODUCT.lower()
    assert capture.get_config()["protocol_version"] == 4
    assert capture.get_capture(address(direct_alice), "source-1") == result

def test_duplicate_capture_is_idempotent_even_when_source_changes(capture, direct_vm):
    source(direct_vm, "Original")
    original = capture.capture("https://example.com/", "same")
    source(direct_vm, "Changed")
    assert capture.capture("https://example.com/", "same") == original
    assert capture.get_config()["captures"] == 1
    with direct_vm.expect_revert("different URL"):
        capture.capture("https://example.org/", "same")

@pytest.mark.parametrize("url", [
    "http://example.com", "https://localhost", "https://127.0.0.1",
    "https://127.1", "https://2130706433", "https://[::1]/",
    "https://user:secret@example.com/", "https://example.com:80/",
    "https://service.internal/", "https://127.0.0.1.nip.io/",
    "https://example.com/#secret", "https://example.com/\nheader",
    "https://example.com\\@localhost/", "https://example..com/",
])
def test_capture_rejects_unsafe_urls(capture, direct_vm, url):
    with direct_vm.expect_revert():
        capture.capture(url, "blocked")

def test_capture_rejects_empty_and_oversized_sources(capture, direct_vm):
    source(direct_vm, " \n ")
    with direct_vm.expect_revert("no readable text"):
        capture.capture("https://example.com/", "empty")
    source(direct_vm, "é" * 3001)
    with direct_vm.expect_revert("6000"):
        capture.capture("https://example.com/", "large")
    assert capture.get_config()["captures"] == 0

def test_capture_namespace_and_cooldown(capture, direct_vm, direct_alice, direct_bob):
    source(direct_vm, "Public evidence")
    capture.capture("https://example.com/", "first")
    with direct_vm.expect_revert("ten seconds"):
        capture.capture("https://example.com/", "second")
    direct_vm.sender = direct_bob
    capture.capture("https://example.com/", "first")
    assert capture.get_config()["captures"] == 2
    direct_vm.sender = direct_alice
    direct_vm.warp("2026-08-28T00:00:10+00:00")
    capture.capture("https://example.com/", "second")
    with direct_vm.expect_revert("not found"):
        capture.get_capture(address(direct_bob), "second")

def test_capture_validates_nonce_and_product_address(capture, direct_vm, direct_deploy):
    with direct_vm.expect_revert():
        capture.capture("https://example.com/", "../invalid")
    with direct_vm.expect_revert():
        direct_deploy(CONTRACT_PATH, "0x" + "0" * 40, sdk_version="v0.2.16")


def test_constructor_accepts_genvm_address_object(direct_deploy, direct_vm, direct_alice):
    direct_vm.sender = direct_alice
    contract = direct_deploy(CONTRACT_PATH, direct_alice, sdk_version="v0.2.16")
    assert contract.get_config()["product_contract"] == address(direct_alice)
