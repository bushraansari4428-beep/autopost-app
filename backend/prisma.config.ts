import 'dotenv/config';
import { defineConfig } from '@prisma/config';

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL || "postgresql://root:rootpassword@autopost_db:5432/autopost?schema=public",
  },
});
