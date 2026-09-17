import { Injectable, NestMiddleware } from '@nestjs/common';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { SHOP_SUBJECT_HEADER } from './acl.constants.js';
import {
  ANONYMOUS_SUBJECT,
  isShopSubject,
  type ShopSubject,
} from './shop-subject.model.js';
import { SubjectService } from './subject.service.js';

/**
 * Node joins repeated request headers into one comma-separated string for
 * everything except set-cookie. A joined pair of JSON payloads does not parse,
 * so a duplicated subject header lands on the anonymous subject, which is the
 * wanted answer for a request that states two actors.
 */
const singleValue = (
  value: string | string[] | undefined,
): string | undefined => (Array.isArray(value) ? value.join(', ') : value);

/**
 * The subject `header` states, or `ANONYMOUS_SUBJECT` when it states none.
 *
 * `JSON.parse` throws on anything but JSON, and the header is caller-controlled
 * text, so the throw is caught here and answered with the anonymous subject.
 */
function subjectFrom(header: string | undefined): ShopSubject {
  if (!header) return ANONYMOUS_SUBJECT;
  try {
    const parsed: unknown = JSON.parse(header);
    return isShopSubject(parsed)
      ? { id: parsed.id, roles: [...parsed.roles], shop: parsed.shop }
      : ANONYMOUS_SUBJECT;
  } catch {
    return ANONYMOUS_SUBJECT;
  }
}

/**
 * Opens a subject context around every request, so `AclGuard` and every service
 * decide against the same actor.
 *
 * Typed against `node:http` rather than Express, the portability idiom
 * `CorrelationIdMiddleware` follows: only headers are read, so the class works
 * under either adapter.
 *
 * It runs before the guards, which is what lets a guard read the subject. In a
 * deployment this sits behind whatever verifies the session, and reads the
 * verified actor rather than a header.
 */
// #region subject-middleware
@Injectable()
export class SubjectMiddleware implements NestMiddleware {
  constructor(private readonly subjects: SubjectService) {}

  use(
    req: IncomingMessage,
    _res: ServerResponse,
    next: (error?: unknown) => void,
  ): void {
    const header = singleValue(req.headers[SHOP_SUBJECT_HEADER.toLowerCase()]);
    this.subjects.run(subjectFrom(header), next);
  }
}
// #endregion subject-middleware
