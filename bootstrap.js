import dotenv from 'dotenv';
import { execSync } from 'child_process';
import path from 'path';
import app from './src/index.js';
import { logger } from './src/logger.js';

dotenv.config();

(async function run() {
  try {
    const port = process.env.PORT || 3000;
    const mdir = path.join(process.cwd(), 'migrations');

    // 1) Tenta rodar o lint, mas nunca trava o processo
    try {
      logger.info('🔍 Running ESLint...');
      execSync('npm run lint', { stdio: 'inherit' });
    } catch (e) {
      logger.warn('⚠️ ESLint issues detected, continuing bootstrap...');
    }

    // 2) Testes
    logger.info('🧪 Running unit tests...');
    execSync('npm test', { stdio: 'inherit' });

    // 3) Migrations
    logger.info('🔄 Executing migrations...');
    execSync(`psql ${process.env.DATABASE_URL} -f ${mdir}/001_initial_schema.sql`, { stdio: 'inherit' });
    execSync(`psql ${process.env.DATABASE_URL} -f ${mdir}/002_add_indexes.sql`,    { stdio: 'inherit' });
    execSync(`psql ${process.env.DATABASE_URL} -f ${mdir}/003_fix_signals_schema.sql`, { stdio: 'inherit' });
    logger.info('✅ Migrations completed');

    // 4) Start server
    app.listen(port, () => logger.info(`🚀 Server running on port ${port}`));
  } catch (err) {
    logger.error('❌ Bootstrap Error', err);
    process.exit(1);
  }
})();
