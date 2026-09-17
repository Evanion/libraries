import type { HttpService } from '@nestjs/axios';
import { NotFoundException } from '@nestjs/common';
import type { AxiosResponse } from 'axios';
import { of, throwError } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { SHOP_SUBJECT_HEADER } from '../acl/acl.constants.js';
import type { ShopSubject } from '../acl/shop-subject.model.js';
import type { SubjectService } from '../acl/subject.service.js';
import { InventoryClient } from './inventory-client.service.js';

const httpServiceStub = (
  impl: (
    url: string,
    config?: { headers?: Record<string, string> },
  ) => ReturnType<HttpService['get']>,
): HttpService => ({ get: impl }) as unknown as HttpService;

/** A SubjectService answering with one subject, or with none at all. */
const subjectsStub = (subject?: ShopSubject): SubjectService =>
  ({ current: () => subject }) as unknown as SubjectService;

const axiosResponse = <T>(data: T): AxiosResponse<T> =>
  ({
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {} as never,
  }) as AxiosResponse<T>;

describe('InventoryClient', () => {
  it('calls the inventory endpoint on localhost for the given urn', () => {
    let requestedUrl = '';
    const http = httpServiceStub((url) => {
      requestedUrl = url;
      return of(axiosResponse({ urn: 'urn:game:wingspan', quantity: 5 }));
    });
    const client = new InventoryClient(http, subjectsStub());

    client.getStock('urn:game:wingspan');

    expect(requestedUrl).toMatch(
      /^http:\/\/127\.0\.0\.1:\d+\/api\/inventory\//,
    );
    expect(requestedUrl).toContain(encodeURIComponent('urn:game:wingspan'));
  });

  it('sends the request subject on the loopback hop', () => {
    let sent: Record<string, string> | undefined;
    const http = httpServiceStub((_url, config) => {
      sent = config?.headers;
      return of(axiosResponse({ urn: 'urn:game:wingspan', quantity: 5 }));
    });
    const subject: ShopSubject = {
      id: 'staff:ada',
      roles: ['operator'],
      shop: 'stockholm',
    };
    const client = new InventoryClient(http, subjectsStub(subject));

    client.getStock('urn:game:wingspan');

    // The inventory route decides for itself, and this header is what it
    // decides about. Without it the hop would arrive as the anonymous subject.
    expect(sent?.[SHOP_SUBJECT_HEADER]).toBe(JSON.stringify(subject));
  });

  it('resolves with the response body', async () => {
    const stock = {
      urn: 'urn:game:wingspan',
      quantity: 5,
      correlationId: 'abc',
    };
    const http = httpServiceStub(() => of(axiosResponse(stock)));
    const client = new InventoryClient(http, subjectsStub());

    await expect(client.getStock('urn:game:wingspan')).resolves.toEqual(stock);
  });

  it('translates an upstream 404 into a NotFoundException', async () => {
    const http = httpServiceStub(() =>
      throwError(() => ({ isAxiosError: true, response: { status: 404 } })),
    );
    const client = new InventoryClient(http, subjectsStub());

    await expect(client.getStock('urn:game:unknown')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  // The two counters are what orders.e2e.spec.ts reads to prove the provider
  // stayed a singleton, so they have to count what they claim to count.
  it('counts every construction', () => {
    InventoryClient.constructed = 0;
    const http = httpServiceStub(() => of(axiosResponse({})));

    new InventoryClient(http, subjectsStub());
    new InventoryClient(http, subjectsStub());

    expect(InventoryClient.constructed).toBe(2);
  });

  it('increments the initialised counter from onModuleInit', () => {
    InventoryClient.initialised = 0;
    const http = httpServiceStub(() => of(axiosResponse({})));
    const client = new InventoryClient(http, subjectsStub());

    client.onModuleInit();

    expect(InventoryClient.initialised).toBe(1);
  });
});
