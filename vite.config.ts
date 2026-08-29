import { sites } from '@openai/sites-vite-plugin';
import vinext from 'vinext';
import { defineConfig } from 'vite';
import hostingConfig from './.openai/hosting.json';

const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === 'seatbelt';
const placeholderDatabaseId = '00000000-0000-4000-8000-000000000000';

export default defineConfig(async () => {
  process.env.WRANGLER_WRITE_LOGS ??= 'false';
  process.env.MINIFLARE_REGISTRY_PATH ??= '.wrangler/registry';
  const { cloudflare } = await import('@cloudflare/vite-plugin');
  return {
    server: isCodexSeatbeltSandbox ? { watch: { useFsEvents: false, usePolling: true } } : undefined,
    plugins: [vinext(), sites(), cloudflare({
      viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
      config: {
        main: './worker/index.ts',
        compatibility_flags: ['nodejs_compat'],
        d1_databases: [{ binding: hostingConfig.d1, database_name: 'esmorzarets', database_id: placeholderDatabaseId }],
        r2_buckets: [{ binding: hostingConfig.r2, bucket_name: 'esmorzarets-images' }],
      },
    })],
  };
});
