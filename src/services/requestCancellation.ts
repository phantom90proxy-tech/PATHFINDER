export class RequestCancelledError extends Error {
  constructor() {super('Request cancelled'); this.name = 'AbortError';}
}
export const isRequestCancelled = (error: unknown) => error instanceof RequestCancelledError;

// Each accepted service call owns its controller. An unrelated caller's signal
// never reaches it. Race async work too, so late/non-cooperative results cannot
// populate caches or keep the service locked after cancellation.
export function createRequestCancellation(parent?: AbortSignal) {
  const controller = new AbortController();
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cancel = () => {cancelled = true; controller.abort();};
  if (parent?.aborted) cancel();
  else parent?.addEventListener('abort', cancel, {once: true});
  const check = () => {
    if (cancelled) throw new RequestCancelledError();
    if (controller.signal.aborted) throw new Error('Request timed out');
  };
  async function run<T>(work: () => Promise<T>): Promise<T> {
    check();
    let abort!: () => void;
    const aborted = new Promise<never>((_, reject) => {
      abort = () => {try {check();} catch (error) {reject(error);}};
      controller.signal.addEventListener('abort', abort, {once: true});
    });
    try {const result = await Promise.race([work(), aborted]); check(); return result;}
    finally {controller.signal.removeEventListener('abort', abort);}
  }
  return {
    signal: controller.signal, check, run,
    get cancelled() {return cancelled;},
    startTimeout(ms: number) {timer = setTimeout(() => controller.abort(), ms);},
    async wait(ms: number) {
      let delay: ReturnType<typeof setTimeout> | undefined;
      try {await run(() => new Promise<void>(resolve => {delay = setTimeout(resolve, ms);}));}
      finally {clearTimeout(delay);}
    },
    dispose() {clearTimeout(timer); parent?.removeEventListener('abort', cancel);},
  };
}
