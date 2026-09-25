// Helpers over src/data/response-examples.json (F006): real engine output that
// the gateway captured and publishes as its Bazaar and OpenAPI examples.

/** The request an example answers, as the URL a caller would send. */
export function exampleRequest(examples, endpoint) {
  const { endpoint: _name, coin, ...params } = examples._meta.requests[endpoint];
  const path = coin ? `/${endpoint}/${coin}` : `/${endpoint}`;
  const query = Object.entries(params)
    .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join(',') : v}`)
    .join('&');
  return `GET ${path}${query ? `?${query}` : ''}`;
}

/** One line saying where an example comes from and how it was shortened. */
export function exampleCaption(examples, endpoint) {
  const clock = examples._meta.engine_clock.replace('T', ' ').replace(/:00Z$/, ' UTC');
  return (
    `${exampleRequest(examples, endpoint)}: real engine output on market data captured at ${clock}. ` +
    'Lists are cut to 3 items. Live responses may also carry meta.disclaimer, which the gateway adds.'
  );
}
