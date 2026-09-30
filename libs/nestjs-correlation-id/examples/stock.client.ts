/**
 * The `orders` service's client for Baize's `stock` service.
 *
 * Cited by the forwarding page as `region=stock-client`. It is an ordinary
 * `HttpService` consumer: nothing in it names a correlation id, and
 * `src/examples.spec.ts` asserts that the `stock` service receives one anyway.
 */
// #region stock-client
import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class StockClient {
  constructor(private readonly http: HttpService) {}

  async level(game: string): Promise<{ game: string; available: number }> {
    const url = `${process.env['STOCK_URL']}/stock/${encodeURIComponent(game)}`;
    const response = await firstValueFrom(this.http.get(url));
    return response.data;
  }
}
// #endregion stock-client
