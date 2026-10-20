import { InlineCode } from './InlineCode';
import type { RegisterEntry } from './types';
import './entries.css';

/** A few rows of a published register, as a table that stacks on a narrow screen. */
export function EntryTable({ entries }: { entries: RegisterEntry[] }) {
  return (
    <table className="product__entries">
      <caption className="baize-visually-hidden">
        Entries from the security register
      </caption>
      <thead>
        <tr>
          <th scope="col">ID</th>
          <th scope="col">Attack</th>
          <th scope="col">CWE / OWASP</th>
          <th scope="col">How it is handled</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => (
          <tr key={entry.id}>
            <td data-label="ID">{entry.id}</td>
            <td data-label="Attack">{entry.attack}</td>
            <td data-label="CWE / OWASP">{entry.cwe}</td>
            <td data-label="How it is handled">
              <InlineCode text={entry.handled} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
