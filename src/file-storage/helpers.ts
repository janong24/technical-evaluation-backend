import crypto from "node:crypto";

type BufferLike = Uint8Array | DataView | Buffer;

/**
 * Node.js uses "memory pooling" where a Buffer potentially uses a shared underlying ArrayBuffer that
 * backs multiple Buffers (which are like views). The `crypto` built-in, likely for web compat reasons
 * doesn't accept node.js Buffers but instead webstandards DataViews. Be careful to hash the correct
 * portion of the potentially-shared underlying mem
 */
function toDataView(data: BufferLike): DataView | Uint8Array {
  if (data instanceof Buffer) {
    const bufferPoolMem = data.buffer;
    const binaryLikeView = new DataView(
      bufferPoolMem,
      data.byteOffset,
      data.byteLength
    );
    return binaryLikeView;
  }

  return data;
}

export function computeChecksum(data: BufferLike): string {
  const dataView = toDataView(data);
  return crypto.createHash("sha1").update(dataView).digest("hex");
}
