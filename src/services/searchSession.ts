// A new focus gets a new generation: old responses cannot revive after re-entry.
export function createSearchSession() {
  let active = true;
  let generation = 0;
  let request: AbortController | undefined;
  const cancelRequest = () => {request?.abort(); request = undefined;};
  return {
    activate() {generation++; active = true; cancelRequest();},
    exit() {generation++; active = false; cancelRequest();},
    cancelRequest,
    beginRequest() {
      cancelRequest(); request = new AbortController();
      if (!active) request.abort();
      return request.signal;
    },
    isActive: () => active,
    capture() {const current = generation; return () => active && generation === current;},
  };
}
