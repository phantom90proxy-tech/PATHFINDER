// A new focus gets a new generation: old responses cannot revive after re-entry.
export function createSearchSession() {
  let active = true;
  let generation = 0;
  return {
    activate() {generation++; active = true;},
    exit() {generation++; active = false;},
    isActive: () => active,
    capture() {const current = generation; return () => active && generation === current;},
  };
}
