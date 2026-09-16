'use client';

import { Button } from '@evanion/baize-ui';
import { useId, useMemo, useState } from 'react';
import {
  buildAccess,
  controls,
  decisionsOf,
  isLit,
  openingGrants,
  people,
  roles,
  source,
  type Grants,
  type Role,
} from './access';

/** The document the interface is built around. Copy, not lorem. */
const TITLE = 'Q3 retrospective';
const BODY =
  'We shipped the widget core in August and moved the documentation onto it the week after. Three adapters now render from the same item shape.';

/** One comment under the document. */
interface Note {
  by: string;
  text: string;
}

const OPENING_NOTES: Note[] = [
  { by: 'Jo Vainio', text: 'Can we get the adapter table in before Friday?' },
];

/** A role, as the interface names it. */
function label(role: Role): string {
  return role[0]!.toUpperCase() + role.slice(1);
}

interface RoleSwitchProps {
  role: Role;
  onChange: (role: Role) => void;
}

/**
 * Who is signed in, and the control that changes it.
 *
 * Radio inputs rather than buttons: one of three is exactly what a radio group
 * is, and a browser already gives it arrow-key navigation, a single tab stop and
 * the right announcement. The inputs are off-screen and the segment beside each
 * is what is drawn, so the focus ring follows the input onto the segment.
 */
function RoleSwitch({ role, onChange }: RoleSwitchProps) {
  const group = useId();
  return (
    <div className="landing-seg" role="group" aria-label="Signed in as">
      {roles.map((option) => (
        <label key={option} className="landing-seg__option">
          <input
            className="landing-sr-only"
            type="radio"
            name={`${group}-role`}
            value={option}
            checked={role === option}
            onChange={() => onChange(option)}
          />
          <span className="landing-seg__face">{label(option)}</span>
        </label>
      ))}
    </div>
  );
}

/**
 * An interface that rebuilds itself from a policy, and the policy that did it.
 *
 * Change who is signed in and the document's controls change with them: a viewer
 * comments, an editor edits, an owner publishes. Nothing is hidden by hand --
 * every control on the bar is `access.can` answering for that person, and a
 * control the policy does not grant is not rendered, which is what the browser
 * half of this library is for.
 *
 * The roles inside the policy are controls too. Take `editor` out of the edit
 * grant and Mika loses the button while you are looking at it. The policy is
 * rebuilt from the package's typed builder on every change, so what the reader
 * edits is the real document and not a script of outcomes.
 *
 * Pressing a control does what it says, because a demonstration whose buttons do
 * nothing is a picture of an interface rather than one. Publishing is the second
 * reconfiguration: a published post has a deny rule over `edit`, and a deny
 * beats an allow, so the button everyone had a moment ago leaves the bar.
 *
 * A control that arrives rises into place over 160ms and one that leaves goes at
 * once, so what changed is the thing that moves. Nothing else on the page
 * animates, and under `prefers-reduced-motion` this does not either.
 */
export default function AccessDemo() {
  const [role, setRole] = useState<Role>('editor');
  const [grants, setGrants] = useState<Grants>(openingGrants);
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [body, setBody] = useState(BODY);
  const [editing, setEditing] = useState(false);
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState('');
  const [notes, setNotes] = useState<Note[]>(OPENING_NOTES);
  const bodyId = useId();

  const access = useMemo(() => buildAccess(grants), [grants]);
  const person = people.find((candidate) => candidate.role === role)!;
  const post = { status };
  const decisions = decisionsOf(access, person, post);
  const granted = controls.filter(
    (control) => decisions[control.action]?.allowed,
  );

  function toggleGrant(action: keyof Grants, option: Role) {
    setGrants({
      ...grants,
      [action]: grants[action].includes(option)
        ? grants[action].filter((held) => held !== option)
        : roles.filter(
            (held) => held === option || grants[action].includes(held),
          ),
    });
  }

  function press(action: string) {
    if (action === 'comment') setComposing(!composing);
    if (action === 'edit') setEditing(!editing);
    if (action === 'publish') {
      setStatus(status === 'draft' ? 'published' : 'draft');
      setEditing(false);
    }
  }

  function postNote() {
    if (draft.trim() === '') return;
    setNotes([...notes, { by: person.name, text: draft.trim() }]);
    setDraft('');
    setComposing(false);
  }

  const canEdit = decisions['edit']?.allowed ?? false;
  const canComment = decisions['comment']?.allowed ?? false;

  return (
    <div className="landing-access">
      <div className="landing-access__app">
        <div className="landing-access__chrome">
          <span className="landing-access__who">{person.name}</span>
          <RoleSwitch role={role} onChange={setRole} />
        </div>

        <article className="landing-access__doc">
          <h3 className="landing-access__title">
            {TITLE}
            <span className="landing-access__status" data-status={status}>
              {status}
            </span>
          </h3>
          <p className="landing-access__byline">
            Written by Mika Persson, updated on Tuesday
          </p>

          {editing && canEdit ? (
            <textarea
              id={bodyId}
              className="landing-access__body landing-access__field"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              aria-label="Document body"
            />
          ) : (
            <p className="landing-access__body">{body}</p>
          )}

          <ul className="landing-access__notes">
            {notes.map((note) => (
              <li key={`${note.by}-${note.text}`}>
                <span className="landing-access__note-by">{note.by}</span>
                {note.text}
              </li>
            ))}
          </ul>

          {composing && canComment ? (
            <div className="landing-access__composer">
              <input
                className="landing-access__field"
                value={draft}
                placeholder="Add a comment"
                aria-label="Add a comment"
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') postNote();
                }}
              />
              <Button variant="quiet" onClick={postNote}>
                Post
              </Button>
            </div>
          ) : null}
        </article>

        <div className="landing-access__bar">
          {granted.map((control) => (
            <span key={control.action} className="landing-access__control">
              <Button
                variant={
                  control.action === 'publish'
                    ? 'primary'
                    : control.action === 'edit'
                      ? 'standard'
                      : 'quiet'
                }
                onClick={() => press(control.action)}
              >
                {control.action === 'edit' && editing
                  ? 'Done'
                  : control.action === 'comment' && composing
                    ? 'Cancel'
                    : control.label(post)}
              </Button>
            </span>
          ))}
        </div>

        <output className="landing-sr-only" aria-live="polite">
          {`Signed in as ${person.name}, ${role}. ${
            granted.length === 0
              ? 'No controls.'
              : `${granted.map((control) => control.label(post)).join(', ')}.`
          }`}
        </output>
      </div>

      <div className="landing-access__policy">
        <p className="landing-demo__label">access</p>
        <pre className="landing-access__source">
          <code>
            {source.map((line, index) => (
              <span
                key={index}
                className="landing-access__line"
                data-lit={isLit(line, decisions) ? '' : undefined}
                data-side={line.rule?.side}
              >
                {line.segments.map((segment, at) =>
                  'text' in segment ? (
                    <span key={at}>{segment.text}</span>
                  ) : (
                    <span key={at} className="landing-access__grant">
                      [
                      {roles.map((option, position) => (
                        <span key={option}>
                          {position > 0 ? ', ' : null}
                          <button
                            type="button"
                            className="landing-access__role"
                            aria-pressed={grants[segment.grant].includes(
                              option,
                            )}
                            onClick={() => toggleGrant(segment.grant, option)}
                          >
                            &apos;{option}&apos;
                          </button>
                        </span>
                      ))}
                      ]
                    </span>
                  ),
                )}
              </span>
            ))}
          </code>
        </pre>
      </div>
    </div>
  );
}
