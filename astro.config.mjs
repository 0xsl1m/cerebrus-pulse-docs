import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  site: 'https://pulse.openclaw.ai',
  integrations: [
    starlight({
      title: 'Cerebrus Pulse',
      description: 'Real-time crypto intelligence via x402 micropayments',
      logo: {
        src: './src/assets/pulse-logo.svg',
        replacesTitle: false,
      },
      customCss: ['./src/styles/landing.css'],
      social: [
        { icon: 'x.com', label: 'X / Twitter', href: 'https://x.com/opencloaw' },
      ],
      sidebar: [
        {
          label: 'Getting Started',
          items: [
            { label: 'Overview', slug: 'overview' },
            { label: 'Quickstart', slug: 'quickstart' },
          ],
        },
        {
          label: 'API Reference',
          items: [
            { label: 'GET /pulse/{coin}', slug: 'api/pulse' },
            { label: 'GET /sentiment', slug: 'api/sentiment' },
            { label: 'GET /funding/{coin}', slug: 'api/funding' },
            { label: 'GET /bundle/{coin}', slug: 'api/bundle' },
            { label: 'GET /health', slug: 'api/health', badge: 'Free' },
            { label: 'GET /coins', slug: 'api/coins', badge: 'Free' },
          ],
        },
        {
          label: 'Guides',
          items: [
            { label: 'x402 Payments', slug: 'guides/x402-payments' },
            { label: 'Python SDK', slug: 'guides/python-sdk' },
            { label: 'TypeScript SDK', slug: 'guides/typescript-sdk' },
            { label: 'ACP for Agents', slug: 'guides/acp-agents' },
          ],
        },
        {
          label: 'Reference',
          items: [
            { label: 'Response Schemas', slug: 'reference/response-schemas' },
            { label: 'Supported Coins', slug: 'reference/coins-list' },
            { label: 'Rate Limits & Errors', slug: 'reference/rate-limits' },
            { label: 'x402 vs ACP', slug: 'reference/x402-vs-acp' },
          ],
        },
      ],
      editLink: undefined,
    }),
    tailwind({ applyBaseStyles: false }),
  ],
});
