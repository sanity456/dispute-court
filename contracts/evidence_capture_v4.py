# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""Validator-verified evidence preparation, not a verdict or a funds custodian.

The linked product still re-fetches the original URL when judging evidence.
Snapshots are public and immutable. Each product deploys its own instance.
"""
import hashlib
import json
import re
from datetime import datetime, timezone
from genlayer import *

MAX_SOURCE_BYTES = 6000
MAX_ACCOUNT_CAPTURES = 1000

def _public_url(value: str) -> str:
    url = value.strip() if isinstance(value, str) else ""
    if (
        len(url) > 2048
        or not re.fullmatch(r"https://[A-Za-z0-9.-]+(?::443)?(?:[/?][\x21-\x7e]*)?", url)
        or "\\" in url
        or "#" in url
    ):
        raise gl.vm.UserError("[EXPECTED] Use a public HTTPS URL without credentials, fragments, or unusual ports")
    authority = re.split(r"[/?]", url[8:], maxsplit=1)[0].removesuffix(":443")
    host = authority.lower().removesuffix(".")
    if len(host) > 253 or host.endswith((".local", ".localhost", ".internal", ".test", ".invalid", ".onion", ".nip.io", ".sslip.io", ".xip.io")):
        raise gl.vm.UserError("[EXPECTED] Private and address-alias hosts are not supported")
    labels = host.split(".")
    if len(labels) < 2 or not re.fullmatch(r"[a-z]{2,63}", labels[-1]):
        raise gl.vm.UserError("[EXPECTED] Use a public DNS hostname, not an IP address")
    for label in labels:
        if not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?", label):
            raise gl.vm.UserError("[EXPECTED] Invalid public hostname")
    return url


def _account(value) -> str:
    if isinstance(value, (bytes, bytearray)) and len(value) == 20:
        text = "0x" + bytes(value).hex()
    else:
        text = str(value).strip() if value is not None else ""
    if not re.fullmatch(r"0x[0-9a-fA-F]{40}", text) or int(text[2:], 16) == 0:
        raise gl.vm.UserError("[EXPECTED] Invalid account address")
    return text.lower()

def _request_id(value: str) -> str:
    if not isinstance(value, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,80}", value):
        raise gl.vm.UserError("[EXPECTED] Capture request ID must be 1–80 letters, digits, underscores, or hyphens")
    return value

class EvidenceCaptureV4(gl.Contract):
    product_contract: str
    snapshots: TreeMap[str, str]
    account_counts: TreeMap[str, u256]
    account_last_capture: TreeMap[str, u256]
    total: u256

    def __init__(self, product_contract: str):
        self.product_contract = _account(product_contract)
        self.total = u256(0)

    @gl.public.write
    def capture(self, url: str, request_id: str) -> dict:
        clean_url = _public_url(url)
        nonce = _request_id(request_id)
        sender = str(gl.message.sender_address).lower()
        key = sender + ":" + nonce
        existing = self.snapshots.get(key)
        if existing is not None:
            snapshot = json.loads(existing)
            if snapshot["url"] != clean_url:
                raise gl.vm.UserError("[EXPECTED] This request ID already belongs to a different URL")
            return snapshot
        count = int(self.account_counts.get(sender, u256(0)))
        if count >= MAX_ACCOUNT_CAPTURES:
            raise gl.vm.UserError("[EXPECTED] Account capture limit reached")
        now = int(datetime.now(timezone.utc).timestamp())
        previous = int(self.account_last_capture.get(sender, u256(0)))
        if previous and now - previous < 10:
            raise gl.vm.UserError("[EXPECTED] Wait ten seconds between new captures")

        def render_source():
            try:
                source = str(gl.nondet.web.render(clean_url, mode="text"))
            except Exception:
                raise gl.vm.UserError("[TRANSIENT] Source could not be rendered; use a stable public page")
            normalized = re.sub(r"\s+", " ", source).strip()
            if not normalized:
                raise gl.vm.UserError("[EXTERNAL] Source contains no readable text")
            if len(normalized.encode("utf-8")) > MAX_SOURCE_BYTES:
                raise gl.vm.UserError("[EXTERNAL] Source exceeds 6000 UTF-8 bytes; use a smaller dedicated page")
            return normalized

        normalized = gl.eq_principle.strict_eq(render_source)
        snapshot = {
            "id": key, "request_id": nonce, "account": sender,
            "product_contract": self.product_contract, "url": clean_url,
            "digest": hashlib.sha256(normalized.encode("utf-8")).hexdigest(),
            "text": normalized, "byte_length": len(normalized.encode("utf-8")),
            "captured_at": now, "normalization": "python-re-whitespace-v1",
            "warning": "A capture is not a verdict. The product re-fetches this URL; changed content will not match.",
        }
        self.snapshots[key] = json.dumps(snapshot, separators=(",", ":"))
        self.account_counts[sender] = u256(count + 1)
        self.account_last_capture[sender] = u256(now)
        self.total = u256(int(self.total) + 1)
        return snapshot

    @gl.public.view
    def get_capture(self, account: str, request_id: str) -> dict:
        key = _account(account) + ":" + _request_id(request_id)
        raw = self.snapshots.get(key)
        if raw is None:
            raise gl.vm.UserError("[EXPECTED] Capture not found")
        return json.loads(raw)

    @gl.public.view
    def get_config(self) -> dict:
        return {"protocol_version": 4, "product_contract": self.product_contract, "captures": int(self.total),
                "max_source_bytes": MAX_SOURCE_BYTES, "max_account_captures": MAX_ACCOUNT_CAPTURES,
                "funds_accepted": False, "normalization": "python-re-whitespace-v1"}
