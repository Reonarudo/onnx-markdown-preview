/**
 * The vendored Netron modules (`vendor/netron/`, see THIRD_PARTY_NOTICES.md) are plain JavaScript,
 * reached through the `netron/*` path in tsconfig.json;
 * these declarations cover only what `src/context.ts` and `src/model.ts` reach into.
 */
declare module 'netron/onnx.js' {
  export const ModelFactory: new () => {
    match(context: unknown): Promise<string | null | undefined>;
    open(context: unknown): Promise<unknown>;
  };
}
declare module 'netron/onnx-proto.js' {
  export const onnx: unknown;
}
declare module 'netron/protobuf.js' {
  export const BinaryReader: { open(data: unknown, offset?: number): { signature(): Map<number, number>; decode(): unknown } };
  export const TextReader: { open(data: unknown): { signature(): Map<string, unknown> } | null };
}
declare module 'netron/text.js' {
  export const Reader: { open(data: unknown, length?: number): unknown };
  export const Decoder: { open(data: unknown, encoding?: string): unknown };
}
declare module 'netron/json.js' {
  export const TextReader: { open(data: unknown): { read(): unknown } | null };
}
declare module 'netron/onnx-metadata.json' {
  const metadata: unknown;
  export default metadata;
}
