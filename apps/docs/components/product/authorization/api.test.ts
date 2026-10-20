import { describe, expect, it } from 'vitest';
import {
  buildAccess,
  openingGrants,
  people,
  roles,
} from '../../landing/access';
import { apiAnswer } from './api';

const statuses = ['draft', 'published'] as const;

describe('the API panel', () => {
  it.each(
    roles.flatMap((role) => statuses.map((status) => [role, status] as const)),
  )('answers %s on a %s listing exactly as can does', (role, status) => {
    const access = buildAccess(openingGrants);
    const expected = access.can(people[role], 'listing', 'edit', { status });
    const answer = apiAnswer(role, status, openingGrants);
    expect(answer.edit.allowed).toBe(expected.allowed);
    expect(answer.edit.status).toBe(expected.allowed ? 200 : 403);
    expect(answer.edit.line).toContain(String(answer.edit.status));
  });

  it('names the deny rule on a published listing', () => {
    const answer = apiAnswer('owner', 'published', openingGrants);
    expect(answer.edit.line).toBe(
      'PUT /listings/42 → 403 · published-is-locked',
    );
  });

  it('answers 200 for a bookseller on a draft', () => {
    expect(apiAnswer('bookseller', 'draft', openingGrants).edit.line).toBe(
      'PUT /listings/42 → 200',
    );
  });

  it('follows the grants the reader edits', () => {
    const grants = { ...openingGrants, edit: ['owner'] as const };
    expect(apiAnswer('bookseller', 'draft', grants).edit.status).toBe(403);
  });

  it('answers the publish route too', () => {
    expect(apiAnswer('owner', 'draft', openingGrants).publish.status).toBe(200);
    expect(apiAnswer('customer', 'draft', openingGrants).publish.status).toBe(
      403,
    );
  });
});
