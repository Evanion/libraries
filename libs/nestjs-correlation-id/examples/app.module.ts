/**
 * The root module of Baize's `orders` service, as the Setup article registers
 * it.
 *
 * `apps/docs/content/nestjs-correlation-id/*.mdx` cites the region below
 * through `file=libs/nestjs-correlation-id/examples/app.module.ts
 * region=register`, so what a reader copies off a page is this file.
 * `src/examples.spec.ts` boots it behind a real HTTP server and asserts what
 * the page says a request gets.
 *
 * Outside `src/`, so `package.json`'s `files` never packs it and the library
 * build never reaches it: an example is documentation, not API.
 */
// #region register
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import {
  CorrelationIdMiddleware,
  CorrelationModule,
} from '@evanion/nestjs-correlation-id';

@Module({
  imports: [CorrelationModule.forRoot()],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
// #endregion register
