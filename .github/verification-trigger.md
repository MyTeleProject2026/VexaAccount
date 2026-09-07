# Verification Trigger

This file exists to document the repository verification entry point.

## Current baseline

VexaAccount `master` contains the production SSO/account/owner workflows documented in the repository README and `docs/`.

## Integration boundary

MTP2026 consumes VexaAccount as an external identity provider. MTP2026 implementation changes must be made in `MyTeleProject2026/MTP2026-App-Launcher`; do not modify VexaAccount source code for ordinary MTP work.

## Verification boundary

Repository CI, smoke tests and E2E workflows validate source/runtime contracts. They do not by themselves prove a real production browser login unless authenticated production credentials and deployed services are exercised.
