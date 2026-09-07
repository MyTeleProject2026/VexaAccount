# VexaAccount Verification Trigger

This file documents the repository verification boundary and exists as a lightweight, reviewable reference for the GitHub Actions verification workflows.

## Current repository boundary

VexaAccount `master` is the identity/account provider. Its source includes the backend, User frontend, Super Admin frontend, SSO registry, account/security workflows, System C observability, packaging and Owner integration tooling.

## Verification layers

Repository verification may cover syntax/build contracts, migration consistency, route/security contracts, runtime smoke behavior and authenticated E2E behavior when the required production credentials are configured.

A workflow that passes source-level checks must not be described as a successful production browser login unless the deployed services and real authenticated path were exercised.

## MTP2026 integration boundary

MTP2026 consumes VexaAccount as an external SSO provider. MTP-specific backend/frontend/session/deployment changes belong in `MyTeleProject2026/MTP2026-App-Launcher`.

## SSO security boundary

Production consumer authentication should use Authorization Code + S256 PKCE, exact registered HTTPS redirect URIs, server-side token exchange and a consumer-owned secure session. Provider secrets and refresh tokens must not enter browser bundles or logs.

## Owner integration installation

The Owner GitHub installer is protected by signed source-plan verification, current source blob checks, unchanged branch-head checks, a signed generated-file manifest, exact generated-file SHA-256/size verification and explicit Owner approval. Any integrity mismatch must fail closed.
