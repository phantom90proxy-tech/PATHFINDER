import type {Place} from './placeSearch';

export type Endpoint = 'origin' | 'destination';

// Endpoint identity, rather than query text, owns the user's selected place.
export function createEndpointConfirmations(onConfirmedChange: () => void = () => {}) {
  let revision = 0;
  let values: Record<Endpoint, {query: string; place?: Place}> = {
    origin: {query: ''}, destination: {query: ''},
  };
  return {
    edit(endpoint: Endpoint, query: string) {
      if (values[endpoint].query === query) return;
      values[endpoint] = {query};
      revision++;
    },
    swap() {
      values = {origin: values.destination, destination: values.origin};
      revision++;
      // Equal input strings can leave React state unchanged. Notify persistence
      // after moving the endpoint identities, just as for a confirmed selection.
      onConfirmedChange();
    },
    capture() {
      const captured = revision;
      return () => captured === revision;
    },
    get(endpoint: Endpoint, query: string) {
      return values[endpoint].query === query ? values[endpoint].place : undefined;
    },
    confirm(endpoint: Endpoint, query: string, place: Place, isCurrent: () => boolean) {
      if (!isCurrent() || values[endpoint].query !== query) return false;
      values[endpoint] = {query, place: {...place, point: {...place.point}}};
      onConfirmedChange();
      return true;
    },
  };
}
