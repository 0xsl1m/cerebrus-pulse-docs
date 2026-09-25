# Trimmed from gateway acp-v2/provider_loop.py: only the shapes sync-gateway.mjs parses.
OFFERINGS = {
    "cerebrus_lite": ("cerebrus_lite", lambda coin: {"endpoint": "pulse", "coin": coin,
                                                     "timeframes": ["1h", "4h"]}),
    "cerebrus_premium": ("cerebrus_premium", lambda coin: {"endpoint": "bundle", "coin": coin,
                                                           "timeframes": ["15m", "1d"]}),
}


def price_for(service_key: str) -> float | None:
    retail = {"cerebrus_lite": 0.25, "cerebrus_premium": 2.5}
    return retail.get(service_key)
