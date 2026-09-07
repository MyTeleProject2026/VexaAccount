# SSO Owner Integration Diagnostics

Use this sequence when an SSO consumer cannot log in.

1. Confirm the Super Admin session is live.
2. Inspect the registered client ID and active status.
3. Compare the consumer redirect URI with the registered URI byte-for-byte after canonical URL normalization.
4. Confirm requested scopes are allowed.
5. Confirm the consumer sends the registered client secret only server-side.
6. Confirm PKCE method is S256 and the verifier matches the original challenge.
7. Confirm authorization state is fresh and has not already been consumed.
8. Confirm token exchange returns an access token and expected refresh-token lifecycle.
9. Confirm userinfo returns a stable `sub`.
10. Confirm downstream consumer session creation succeeds.
11. For logout/consent problems, inspect both local consumer session state and VexaAccount SSO session/refresh-token state.

### MTP2026

Check the MTP backend first. MTP owns its state table, session table, encryption key and cookie. VexaAccount remains the provider. Do not patch VexaAccount merely because an MTP consumer-side error appears.

### Security

Never request or log raw client secrets, refresh tokens, authorization codes or PKCE verifiers during diagnosis.
