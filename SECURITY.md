# Security policy

## Reporting a vulnerability

Please report security issues privately through
[GitHub's private vulnerability reporting](https://github.com/KRoperUK/forwardz-nx/security/advisories/new).
If private reporting is unavailable, contact the repository owner through the
verified GitHub profile before publishing details.

Do not include `prod.keys`, console dumps, private signing keys, or raw
personal data in issues, pull requests, logs, or screenshots. Redact paths and
identifiers when reporting a problem.

Forwardz is intended to work with keys dumped from the user's own console. The
application and CI must never bundle, upload, or print key material.
