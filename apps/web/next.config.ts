import type { NextConfig } from 'next';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const monorepoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  output: 'standalone',
  outputFileTracingRoot: monorepoRoot,
  transpilePackages: ['@restaurante/ui', '@restaurante/types', '@restaurante/config']
};

export default nextConfig;
