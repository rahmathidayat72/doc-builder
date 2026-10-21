import os
import re
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent

EXCLUDE_DIRS = {
    ".git",
    "node_modules",
    ".venv",
    "venv",
    "dist",
    "build",
    "__pycache__",
    ".pytest_cache",
    ".tmp",
}

EXCLUDE_FILES = {
    "package-lock.json",
    "conversations.json",
}

PATTERNS = [
    (r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----", "Private Key Header"),
    (r"AKIA[0-9A-Z]{16}", "AWS Access Key"),
    (r"(?:api[_-]?key|secret[_-]?key|private[_-]?key)\s*[:=]\s*['\"][A-Za-z0-9+/=_-]{24,}['\"]", "Hardcoded API/Secret Key"),
    (r"(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}", "GitHub Token"),
    (r"sk-[a-zA-Z0-9]{32,}", "OpenAI API Key"),
    (r"xox[baprs]-[0-9]{10,}-[0-9]{10,}-[a-zA-Z0-9]{24,}", "Slack Token"),
]


def scan_file(file_path: Path) -> list[tuple[int, str, str]]:
    findings = []
    try:
        content = file_path.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return findings

    lines = content.splitlines()
    for idx, line in enumerate(lines, start=1):
        # Ignore comments or obvious placeholders/examples
        if any(marker in line.lower() for marker in ("sample", "dummy", "placeholder", "example", "<your-", "test")):
            continue

        for pattern, label in PATTERNS:
            if re.search(pattern, line):
                findings.append((idx, label, line.strip()[:80]))
    return findings


def main():
    print(f"Scanning for hardcoded secrets in: {ROOT_DIR}")
    total_files = 0
    total_findings = 0

    for root, dirs, files in os.walk(ROOT_DIR):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]

        for file in files:
            if file in EXCLUDE_FILES:
                continue

            file_path = Path(root) / file
            if file_path.suffix.lower() not in (
                ".py",
                ".ts",
                ".tsx",
                ".js",
                ".jsx",
                ".json",
                ".yaml",
                ".yml",
                ".env",
                ".env.example",
                ".toml",
                ".md",
            ):
                continue

            total_files += 1
            file_findings = scan_file(file_path)
            if file_findings:
                rel_path = file_path.relative_to(ROOT_DIR)
                print(f"[!] Finding in {rel_path}:")
                for line_no, label, snippet in file_findings:
                    print(f"    Line {line_no} [{label}]: {snippet}")
                total_findings += len(file_findings)

    print(f"\nScan complete: {total_files} files scanned, {total_findings} secrets found.")
    if total_findings > 0:
        sys.exit(1)
    else:
        print("[OK] Zero hardcoded secrets detected.")
        sys.exit(0)


if __name__ == "__main__":
    main()
