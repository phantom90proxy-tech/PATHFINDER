export type CameraAction = {type: 'fit'} | {type: 'locate'; point: {latitude: number; longitude: number}};
export type MapSessionState = {generation: number; status: 'loading' | 'ready' | 'failed'; error: string | null};
type Message = {generation: number; type: 'ready' | 'error' | 'select'; id?: string};

// Owns one WebView lifetime at a time. Retired documents cannot revive or select.
export function createMapSession(timeoutMs = 15000) {
  let state: MapSessionState = {generation: 0, status: 'loading', error: null};
  let disposed = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let listener: ((state: MapSessionState) => void) | undefined;
  let camera: CameraAction | null = null;
  const clear = () => {if (timer) clearTimeout(timer); timer = undefined;};
  const publish = () => listener?.({...state});
  const fail = (generation: number, error: string) => {
    if (disposed || generation !== state.generation || state.status === 'failed') return;
    clear(); state = {...state, status: 'failed', error}; publish();
  };
  return {
    snapshot: () => ({...state}),
    subscribe(next: (state: MapSessionState) => void) {listener = next; return () => {listener = undefined;};},
    start() {
      clear(); disposed = false;
      state = {generation: state.generation + 1, status: 'loading', error: null};
      const generation = state.generation;
      timer = setTimeout(() => fail(generation, 'Map initialization timed out. Tap Retry map to try again.'), timeoutMs);
      publish(); return generation;
    },
    fail,
    receive(raw: string): Message | null {
      let message: Message;
      try {message = JSON.parse(raw);} catch {return null;}
      if (!message || disposed || message.generation !== state.generation || state.status === 'failed') return null;
      if (message.type === 'error') {fail(message.generation, 'The map script could not run. Tap Retry map to reload it.'); return null;}
      if (message.type === 'ready' && state.status === 'loading') {
        clear(); state = {...state, status: 'ready'}; publish(); return message;
      }
      return message.type === 'select' && state.status === 'ready' && typeof message.id === 'string' ? message : null;
    },
    queueCamera(action: CameraAction) {camera = action;},
    takeCamera(generation: number) {
      if (disposed || generation !== state.generation || state.status !== 'ready') return null;
      const next = camera; camera = null; return next;
    },
    dispose() {clear(); disposed = true; listener = undefined; camera = null;},
  };
}
