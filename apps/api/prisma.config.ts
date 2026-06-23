import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

config({ path: '../../.env' });
config({ path: '.env', override: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'tsx prisma/seed.ts'
  }
});
