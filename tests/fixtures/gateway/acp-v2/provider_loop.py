# Trimmed from gateway acp-v2/provider_loop.py: only the shapes sync-gateway.mjs parses.
OFFERINGS = {
    "cerebrus_lite": ("cerebrus_lite", lambda coin: {"endpoint": "pulse", "coin": coin,
                                                     "timeframes": ["1h", "4h"]}),
    "cerebrus_premium": ("cerebrus_premium", lambda coin: {"endpoint": "bundle", "coin": coin,
                                                           "timeframes": ["15m", "1d"]}),
    "pulse": ("cerebrus_pulse", lambda coin: {"endpoint": "pulse", "coin": coin,
                                              "timeframes": ["1h", "4h"]}),
}

# Retail price per cost_gate service key.
RETAIL_USDC = {"cerebrus_lite": 0.25, "cerebrus_premium": 2.5,
               "cerebrus_pulse": 0.03}


def price_for(service_key: str) -> float | None:
    return RETAIL_USDC.get(service_key)
