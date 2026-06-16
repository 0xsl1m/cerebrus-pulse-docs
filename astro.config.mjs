import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://cerebruspulse.xyz',
  integrations: [
    starlight({
      title: 'Cerebrus Pulse',
      description: 'Real-time crypto intelligence via x402 micropayments and ACP agent commerce',
      logo: {
        src: './src/assets/pulse-logo.png',
        replacesTitle: false,
      },
      components: {
        Head: './src/components/StarlightHead.astro',
      },
      customCss: ['./src/styles/landing.css'],
      social: [
        // NOTE (SEO/trust): @CerebrusPulse on X was suspended twice and is likely
        // permanently dead (see .claude/rules/social-platform-safety.md). A dead/suspended
        // social link is a negative trust signal and a JSON-LD sameAs liability.
        // Commented out pending a decision on a live replacement profile — DO NOT guess a URL.
        // { icon: 'x.com', label: 'X/Twitter', href: 'https://x.com/CerebrusPulse' },
        { icon: 'github', label: 'GitHub', href: 'https://github.com/0xsl1m/cerebrus-pulse-mcp' },
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
            { label: 'GET /screener', slug: 'api/screener', badge: 'New' },
            { label: 'GET /pulse/{coin}', slug: 'api/pulse' },
            { label: 'GET /sentiment', slug: 'api/sentiment' },
            { label: 'GET /funding/{coin}', slug: 'api/funding' },
            { label: 'GET /oi/{coin}', slug: 'api/oi', badge: 'New' },
            { label: 'GET /spread/{coin}', slug: 'api/spread', badge: 'New' },
            { label: 'GET /correlation', slug: 'api/correlation', badge: 'New' },
            { label: 'GET /basis/{coin}', slug: 'api/basis', badge: { text: 'Chainlink', variant: 'tip' } },
            { label: 'GET /depeg', slug: 'api/depeg', badge: { text: 'Chainlink', variant: 'tip' } },
            { label: 'GET /arb', slug: 'api/arb' },
            { label: 'GET /cex-dex/{token}', slug: 'api/cex-dex' },
            { label: 'GET /liquidations/{coin}', slug: 'api/liquidations', badge: 'New' },
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
            { label: 'A2A Protocol', slug: 'guides/a2a-agents' },
            { label: 'ACP for Agents', slug: 'guides/acp-agents' },
          ],
        },
        {
          label: 'Reference',
          items: [
            { label: 'Response Schemas', slug: 'reference/response-schemas' },
            { label: 'Supported Coins', slug: 'reference/coins-list' },
            { label: 'Rate Limits & Errors', slug: 'reference/rate-limits' },
            { label: 'x402 vs A2A vs ACP', slug: 'reference/x402-vs-acp' },
          ],
        },
      ],
      editLink: undefined,
    }),
    tailwind({ applyBaseStyles: false }),
    sitemap(),
  ],
});
