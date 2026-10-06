/** How a transport served a response. Attached out-of-band so cached bodies stay plain JSON. */
export interface CallMeta {
  cache: "memory" | "durable" | null;
}

export const responseMeta = new WeakMap<object, CallMeta>();
