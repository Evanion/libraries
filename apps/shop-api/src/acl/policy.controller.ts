import { serialize, type Access, type Matrix } from '@evanion/acl';
import { Controller, Get, Inject } from '@nestjs/common';
import { ACL_ACCESS } from './acl.constants.js';
import type { ShopObjects } from './shop.policy.js';
import type { ShopSubject } from './shop-subject.model.js';

/** The body `GET /api/policy` answers with. */
export interface PolicyDocument {
  /** What a holder compares against the version it already has, with `!==`. */
  version: string | number | undefined;
  /** The contract itself, which a holder adopts with `parseMatrix`. */
  matrix: Matrix;
}

/**
 * Publishes this service's access matrix to the three frontends.
 *
 * The frontends fetch it once and evaluate it locally, so no decision they make
 * costs a network call. They decide again anyway: a decision a browser reaches
 * toggles an element, and this service re-decides every request on its own copy
 * of the same document.
 *
 * The permissions it carries are the ones marked public, and a permission the
 * marking leaves out never reaches a browser. `serialize` keeps a published
 * permission byte for byte, because a contract that edits a rule stops agreeing
 * with the owner, which is the one property it has.
 */
// #region policy-endpoint
@Controller('policy')
export class PolicyController {
  constructor(
    @Inject(ACL_ACCESS)
    private readonly access: Access<ShopSubject, ShopObjects>,
  ) {}

  @Get()
  read(): PolicyDocument {
    const matrix = serialize(this.access, 'reduced');
    return { version: matrix.version, matrix };
  }
}
// #endregion policy-endpoint
