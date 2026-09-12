import { HttpService } from '@nestjs/axios';
import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { GLOBAL_PREFIX, PORT } from '../config.js';
import type { Stock } from '../inventory/stock.model.js';

interface AxiosLikeError {
  isAxiosError?: boolean;
  response?: { status?: number };
}

const isNotFound = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  (error as AxiosLikeError).response?.status === 404;

/**
 * Calls this same process's own /inventory endpoint over real HTTP, on
 * localhost. That is the correlation-id hop the demo exists to show: same
 * process, real network round trip, id visible on both sides.
 *
 * A plain singleton holding HttpService. Regression guard for
 * nestjs-correlation-id#31: withCorrelation() used to inject the then
 * request-scoped CorrelationService into an HttpModuleOptions factory,
 * which made HttpService -- and every provider holding it, including this
 * one -- request-scoped too: reconstructed per request, onModuleInit never
 * called. `constructed` and `initialised` are the regression guard; both
 * should stay at 1 across any number of requests.
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
