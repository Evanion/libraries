import {
  buildAccess,
  people,
  type Grants,
  type Role,
} from '../../landing/access';

/** What the API answers for one route. */
export interface RouteAnswer {
  allowed: boolean;
  status: 200 | 403;
  /** The route and its answer as a log line, with the rule that refused when one did. */
  line: string;
}

/**
 * What a server running the same policy answers for the person signed in.
 *
 * It asks `can` the question the browser asked and turns the decision into a
 * status. The server decides here; the browser only drew the button.
 */
export function apiAnswer(
  role: Role,
  status: 'draft' | 'published',
  grants: Grants,
): { edit: RouteAnswer; publish: RouteAnswer } {
  const access = buildAccess(grants);
  const route = (action: 'edit' | 'publish', method: string, path: string) => {
    const decision = access.can(people[role], 'listing', action, { status });
    const code = decision.allowed ? 200 : 403;
    const rule =
      !decision.allowed && decision.rule ? ` · ${decision.rule}` : '';
    return {
      allowed: decision.allowed,
      status: code,
      line: `${method} ${path} → ${code}${rule}`,
    } satisfies RouteAnswer;
  };
  return {
    edit: route('edit', 'PUT', '/listings/42'),
    publish: route('publish', 'POST', '/listings/42/publish'),
  };
}
