'use client';

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { hydratePolicy } from '@evanion/acl';
import { PolicyProvider, useCan } from '@evanion/react-acl';

import type { Role } from './access';
import {
  treeControls,
  listings,
  now,
  shop,
  subjects,
  type TreeControl,
  type Status,
} from './policy-tree';
import { RoleSwitch } from './RoleSwitch';

interface NodeProps {
  name: string;
  /** The hook call this component makes, or nothing when it makes none. */
  call?: string;
  /** What came back, as the badge beside the call. */
  answer?: { allowed: boolean; reason: string };
  children?: ReactNode;
}

/** One component of the tree, drawn as the box its children sit inside. */
function Node({ name, call, answer, children }: NodeProps) {
  return (
    <div className="landing-policy__node">
      <p className="landing-policy__head">
        <span className="landing-policy__name">{name}</span>
        {call ? <code className="landing-policy__call">{call}</code> : null}
        {answer ? (
          <span
            className="landing-policy__badge"
            data-allowed={answer.allowed ? '' : undefined}
          >
            {answer.allowed ? 'allowed' : answer.reason}
          </span>
        ) : null}
      </p>
      {children}
    </div>
  );
}

interface ControlNodeProps {
  control: TreeControl;
  listing: Record<string, unknown>;
}

/**
 * One control asking for itself.
 *
 * This is the component the section is about. It takes the listing and nothing
 * else: no `access` prop, no `subject` prop, no `now`. The provider four boxes
 * up holds all three, and `useCan` reads them out of context.
 */
function ControlNode({ control, listing }: ControlNodeProps) {
  const decision = useCan('listing', control.action, listing);

  return (
    <Node
      name={control.component}
      call={`useCan('listing', '${control.action}', listing)`}
      answer={decision}
    />
  );
}

/**
 * The component tree under one provider, and the two things a reader changes.
 *
 * The claim the section makes is that a provider holds one `Access` for a whole
 * tree and a component at any depth asks with three arguments. A reader cannot
 * see that in a listing, because the absence of a prop is not a thing on the
 * page -- so the tree is drawn as nested boxes with each component's whole hook
 * call written on it, and the boxes between the provider and the controls are
 * the ones that would have had to carry the props.
 *
 * The two controls change what the provider holds and what the leaf is asked
 * about, which are the two halves of a decision. Signing in as someone else
 * changes `subject` on the provider and nothing else, and the badges four
 * levels down change with it. Publishing the listing leaves the provider alone
 * and moves one badge, because the shop's deny rule is the only rule that reads
 * the listing's status.
 *
 * `PolicyProvider` and `useCan` are the published ones, and the policy is
 * `shop` from `./policy-tree`, the rules the react-acl examples evaluate.
 *
 * What a reader must not take from it: every badge here is a browser deciding
 * what to draw. The caption says so, and so does the page around it.
 */
export default function PolicySpecimen() {
  const [role, setRole] = useState<Role>('customer');
  const [status, setStatus] = useState<Status>('draft');

  // The document, then an evaluator over it -- which is the trip a matrix makes
  // to a browser, compressed into one line because both ends are on this page.
  // `shop` is the typed builder's `Access<Shopper, …>`, and a provider that
  // serves any policy takes the untyped one, so hydrating is also what makes
  // the two meet.
  const access = useMemo(() => hydratePolicy(shop.matrix), []);
  const context = useMemo(() => ({ now }), []);
  const subject = subjects[role];
  const listing = listings[status];

  return (
    <div className="landing-specimen landing-policy">
      <div className="landing-policy__tree">
        <div className="landing-policy__chrome">
          <RoleSwitch role={role} onChange={setRole} />
          <button
            type="button"
            className="landing-policy__status"
            aria-pressed={status === 'published'}
            onClick={() =>
              setStatus(status === 'draft' ? 'published' : 'draft')
            }
          >
            {status === 'draft' ? 'Publish the listing' : 'Back to draft'}
          </button>
        </div>

        <PolicyProvider access={access} subject={subject} context={context}>
          <Node
            name="PolicyProvider"
            call={`subject={${JSON.stringify(subject['name'])}}`}
          >
            <Node name="ShopPage">
              <Node name="ListingView">
                <Node name="ActionBar">
                  {treeControls.map((control) => (
                    <ControlNode
                      key={control.action}
                      control={control}
                      listing={listing}
                    />
                  ))}
                </Node>
              </Node>
            </Node>
          </Node>
        </PolicyProvider>
      </div>

      <div className="landing-policy__aside">
        <p className="landing-demo__label">what the controls draw</p>
        <ul className="landing-policy__bar">
          {treeControls.map((control) => (
            <li key={control.action}>{control.label}</li>
          ))}
        </ul>
        <p className="landing-policy__note">
          <code>ShopPage</code>, <code>ListingView</code> and{' '}
          <code>ActionBar</code> take no authorization props and pass none down.
          The listing is <code>{String(listing['status'])}</code>.
        </p>
        <p className="landing-policy__note">
          Every badge is a browser deciding what to draw. A control that is not
          rendered is a control that is not rendered; the request behind it is
          still a URL, and the server decides again.
        </p>
      </div>
    </div>
  );
}
