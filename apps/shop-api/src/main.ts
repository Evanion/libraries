import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module.js';
import { GLOBAL_PREFIX, PORT } from './config.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix(GLOBAL_PREFIX);
  await app.listen(PORT);
  Logger.log(
    `Baize shop-api is running on: http://localhost:${PORT}/${GLOBAL_PREFIX}`,
  );
}

bootstrap();
