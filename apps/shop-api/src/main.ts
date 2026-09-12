import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module.js';
import { GLOBAL_PREFIX, PORT } from './config.js';

/**
 * Starts the HTTP server on `PORT` with every route under `GLOBAL_PREFIX`.
 *
 * The prefix is set here and read by InventoryClient when it builds a URL back
 * into this process, so the orders -> inventory hop resolves against the same
 * path this call mounts.
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix(GLOBAL_PREFIX);
  await app.listen(PORT);
  Logger.log(
    `Baize shop-api is running on: http://localhost:${PORT}/${GLOBAL_PREFIX}`,
  );
}

bootstrap();
