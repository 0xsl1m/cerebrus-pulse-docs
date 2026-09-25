# Trimmed from gateway service/server.py: only the shapes sync-gateway.mjs parses.
API_VERSION = "9.9.9"

SKILL_MAP = {
    "confluence-analysis": {"endpoint": "pulse", "needs_coin": True},
    "market-stress": {"endpoint": "arb", "needs_coin": False},
}

X402_ROUTES: dict = {}

if config.get("enabled") and WALLET:
        routes = {
            "GET /pulse/:coin": RouteConfig(
                accepts=make_option(prices.get("pulse", "0.02")),
                description="Cerebrus Pulse: multi-timeframe technical analysis for 50+ perpetuals",
                mime_type="application/json",
                extensions=disc_pulse,
            ),
            "GET /cex-dex/:token": RouteConfig(
                accepts=make_option(prices.get("cex_dex", "0.015")),
                description="Cerebrus CEX-DEX: cross-venue price divergence",
                mime_type="application/json",
                extensions=disc_cex_dex,
            ),
            "GET /arb": RouteConfig(
                accepts=make_option(prices.get("arb", "0.015")),
                description="Cerebrus Stress: cross-chain market stress index",
                mime_type="application/json",
                extensions=disc_arb,
            ),
        }
