// One process owns the JSON database. Readers always see the last durable snapshot.
// Only writes queue; a slow client or login must never block unrelated reads.
export function createStore(initial, write) {
  let state = initial;
  let queue = Promise.resolve();
  return {
    get: () => state,
    update(transform) {
      const operation = queue.then(async () => {
        const next = await transform(state);
        await write(next);
        state = next;
        return next;
      });
      queue = operation.catch(() => {});
      return operation;
    },
  };
}
