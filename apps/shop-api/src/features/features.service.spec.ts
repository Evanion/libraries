import { describe, expect, it } from 'vitest';
import { SubjectService } from '../acl/subject.service.js';
import type { ShopSubject } from '../acl/shop-subject.model.js';
import { FeaturesService } from './features.service.js';
import { buildShopFeatures } from './shop.features.js';

const OPERATOR: ShopSubject = {
  id: 'staff:ada',
  roles: ['operator'],
  shop: 'stockholm',
};

const CUSTOMER: ShopSubject = {
  id: 'cust-0001',
  roles: ['customer'],
  shop: '',
};

const serviceOver = () => {
  const subjects = new SubjectService();
  return {
    subjects,
    service: new FeaturesService(buildShopFeatures(), subjects),
  };
};

describe('FeaturesService', () => {
  it('binds the subject of the request in flight', () => {
    const { subjects, service } = serviceOver();

    const context = subjects.run(OPERATOR, () => service.current().context);

    expect(context.targetingKey).toBe('staff:ada');
    expect(context.roles).toEqual(['operator']);
  });

  it('answers each subject its own flags', () => {
    const { subjects, service } = serviceOver();

    const operator = subjects.run(OPERATOR, () =>
      service.current().isEnabled('new-checkout'),
    );
    const customer = subjects.run(CUSTOMER, () =>
      service.current().isEnabled('new-checkout'),
    );

    expect(operator).toBe(true);
    expect(customer).toBe(false);
  });

  it('keeps overlapping requests apart', async () => {
    const { subjects, service } = serviceOver();
    const read = (subject: ShopSubject) =>
      subjects.run(subject, async () => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return service.current().isEnabled('new-checkout');
      });

    const answers = await Promise.all([read(OPERATOR), read(CUSTOMER)]);

    expect(answers).toEqual([true, false]);
  });

  it('binds an empty context outside a request', () => {
    const { service } = serviceOver();

    const bound = service.current();

    expect(bound.context.targetingKey).toBeUndefined();
    expect(bound.isEnabled('new-checkout')).toBe(false);
  });
});
