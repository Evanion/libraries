import { SectionHeader, Text, Title } from '@evanion/baize-ui';

import { fetchJson, type TelemetryEvent } from './shop-api';

/**
 * What shop-api has been asked for lately, as an async Server Component that
 * fetches its own data.
 *
 * One request, independent of the other two widgets in the region, which is why
 * it is here: three widgets each awaiting their own endpoint is how a consumer
 * actually uses a widget region, and it is a stronger demonstration than one.
 *
 * The events it lists are largely the other widgets' own stock checks, recorded
 * by shop-api's telemetry sink against the correlation id of the request that
 * caused them.
 */

/** How many events to show. The sink holds 500; a page does not need them. */
const SHOWN = 6;

export async function Activity({ heading }: { heading: string }) {
  const events = await fetchJson<TelemetryEvent[]>('/telemetry');
  const recent = [...events].slice(-SHOWN).reverse();

  return (
    <section aria-label={heading}>
      <SectionHeader
        aside={`last ${recent.length} of ${events.length}`}
        heading={
          <Title as="h2" size="md">
            {heading}
          </Title>
        }
      />
      {recent.length === 0 ? (
        <Text tone="moss">Nothing recorded yet.</Text>
      ) : (
        <ol className="events">
          {recent.map((event) => (
            <li key={event.id}>
              {/* ISO rather than a locale format: the server formats this and
                  the browser never re-renders it, so a locale difference
                  between them would be invisible here and a bug elsewhere. */}
              <span className="time">{event.timestamp.slice(11, 19)}</span>
              <span className="source">{event.source}</span>
              <span className="type">{event.type}</span>
              <span className="identifier">
                {event.correlationId ?? 'none'}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
