import { pickAllowedFields, type Access } from '@evanion/acl';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ACL_ACCESS } from '../acl/acl.constants.js';
import type { ShopObjects } from '../acl/shop.policy.js';
import type { ShopSubject } from '../acl/shop-subject.model.js';
import { SubjectService } from '../acl/subject.service.js';
import { GAMES_CATALOGUE } from './games.catalogue.js';
import type { Availability, Game } from './game.model.js';

/**
 * The body of `PATCH /games/:urn`: the fields a caller proposes to write.
 *
 * A type alias and not an interface, so it carries an implicit index signature
 * and `pickAllowedFields` accepts it. Nest hands the raw body through, so a key
 * this type does not name still arrives at runtime; the write axis decides
 * every key of the body, including those, and `pickAllowedFields` drops the
 * ones it refused.
 */
export type GameDeclaration = {
  availability?: Availability;
  price?: number;
};

/** Accessor over the static GAMES_CATALOGUE, with the declared writes on top. */
@Injectable()
export class GamesService {
  /**
   * The writes callers have made, keyed by urn.
   *
   * In memory, per the demo's scope: GAMES_CATALOGUE is a module-level
   * constant, and a restart drops every declaration made against it.
   */
  private readonly declared = new Map<string, GameDeclaration>();

  constructor(
    private readonly subjects: SubjectService,
    @Inject(ACL_ACCESS)
    private readonly access: Access<ShopSubject, ShopObjects>,
  ) {}

  /** The whole catalogue. Copies, so a caller cannot edit the shared rows. */
  findAll(): Game[] {
    return GAMES_CATALOGUE.map((game) => this.current(game));
  }

  /**
   * The game with this urn, which is the full `urn:game:…` string.
   *
   * @throws {NotFoundException} when no game carries that urn, which Nest
   * renders as a 404.
   */
  findByUrn(urn: string): Game {
    const game = GAMES_CATALOGUE.find((candidate) => candidate.urn === urn);
    if (!game) {
      throw new NotFoundException(`No game found for ${urn}`);
    }
    return this.current(game);
  }

  /**
   * Applies a declaration to one title, for the subject of this request.
   *
   * This is the row-level decision, and it is the enforcement point. AclGuard
   * ran before the controller with no row in hand, so it could not compare
   * `object.shop` against `subject.shop` and let the request through; the
   * comparison happens here, against the title the catalogue actually holds.
   *
   * The action is chosen from the body, because the two write actions carry
   * different field allow-lists: `reprice` covers `price` and `availability`
   * and belongs to a manager, `declare` covers `availability` alone and
   * belongs to an operator as well.
   *
   * @throws {UnauthorizedException} when no subject context surrounds the call.
   * @throws {ForbiddenException} when the subject may not take that action on
   * that title, which is what a cross-shop write lands on.
   * @throws {BadRequestException} when the decision allows no field of the
   * body, so applying it would write nothing.
   */
  // #region row-decision
  declare(urn: string, proposed: GameDeclaration): Game {
    const game = this.findByUrn(urn);
    const subject = this.subjects.current();
    if (!subject) throw new UnauthorizedException();

    const action = 'price' in proposed ? 'reprice' : 'declare';
    const decision = this.access.canFields(
      subject,
      'game',
      action,
      game,
      'write',
      proposed,
    );
    if (!decision.action.allowed) {
      throw new ForbiddenException(decision.action.reason);
    }

    // pickAllowedFields keeps the keys the decision marked `allowed` and
    // nothing else, so a denied key and an unevaluable key are both withheld.
    const writable = pickAllowedFields(decision, proposed);
    if (Object.keys(writable).length === 0) {
      throw new BadRequestException('No field of this declaration is writable');
    }

    this.declared.set(urn, { ...this.declared.get(urn), ...writable });
    return this.findByUrn(urn);
  }
  // #endregion row-decision

  /** One catalogue row with the declarations made against it applied. */
  private current(game: Game): Game {
    return { ...game, ...this.declared.get(game.urn) };
  }
}
