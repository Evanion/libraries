import { HttpService } from '@nestjs/axios';
import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { GLOBAL_PREFIX, PORT } from '../config.js';
import type { Stock } from '../inventory/stock.model.js';

/**
 * The shape of a rejected axios request that this file needs, declared locally
 * rather than imported: axios reaches this app only through @nestjs/axios, and
 * a structural check works on whatever the installed copy throws.
 */
interface AxiosLikeError {
  isAxiosError?: boolean;
  response?: { status?: number };
}

/** Whether a rejection carries an upstream 404 response. */
const isNotFound = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  (error as AxiosLikeError).response?.status === 404;

/**
 * Calls this same process's own /inventory endpoint over real HTTP, on
 * localhost. That is the correlation-id hop the demo exists to show: same
 * process, real network round trip, id visible on both sides.
 *
 * `constructed` and `initialised` are the probe for the scope invariant
 * `withCorrelation()` has to preserve. Nest propagates request scope upward, so
 * anything request-scoped on the path from `CorrelationService` to
 * `HttpService` makes this class request-scoped too -- rebuilt per request, and
 * never given `onModuleInit`. Both counters therefore stay at 1 across any
 * number of requests; orders.e2e.spec.ts is what asserts it.
 */
@Injectable()
export class InventoryClient implements OnModuleInit {
  static constructed = 0;
  static initialised = 0;

  private readonly baseUrl = `http://127.0.0.1:${PORT}/${GLOBAL_PREFIX}`;

  constructor(private readonly http: HttpService) {
    InventoryClient.constructed += 1;
  }

  onModuleInit(): void {
    InventoryClient.initialised += 1;
  }

  /**
   * The stock record the /inventory endpoint reports for `urn`, together with
   * the correlation id that endpoint saw.
   *
   * @throws {NotFoundException} when the endpoint answers 404, so the caller
   * handles an unknown urn the same way whether the lookup crossed HTTP or not.
   */
  async getStock(urn: string): Promise<Stock & { correlationId?: string }> {
    try {
      const response = await firstValueFrom(
        this.http.get(`${this.baseUrl}/inventory/${encodeURIComponent(urn)}`),
      );
      return response.data;
    } catch (error) {
      if (isNotFound(error)) {
        throw new NotFoundException(`No stock record for ${urn}`);
      }
      throw error;
    }
  }
}
