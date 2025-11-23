// Auto-generated with deno_bindgen
function encode(v: string | Uint8Array): Uint8Array {
  if (typeof v !== "string") return v;
  return new TextEncoder().encode(v);
}

function decode(v: Uint8Array): string {
  return new TextDecoder().decode(v);
}

// deno-lint-ignore no-explicit-any
function readPointer(v: any): Uint8Array {
  const ptr = new Deno.UnsafePointerView(v);
  const lengthBe = new Uint8Array(4);
  const view = new DataView(lengthBe.buffer);
  ptr.copyInto(lengthBe, 0);
  const buf = new Uint8Array(view.getUint32(0));
  ptr.copyInto(buf, 4);
  return buf;
}

const url = new URL("../target/release", import.meta.url);

let uri = url.pathname;
if (!uri.endsWith("/")) uri += "/";

// https://docs.microsoft.com/en-us/windows/win32/api/libloaderapi/nf-libloaderapi-loadlibrarya#parameters
if (Deno.build.os === "windows") {
  uri = uri.replace(/\//g, "\\");
  // Remove leading slash
  if (uri.startsWith("\\")) {
    uri = uri.slice(1);
  }
}

const { symbols } = Deno.dlopen(
  {
    darwin: uri + "libvmx_deno_ffi.dylib",
    windows: uri + "vmx_deno_ffi.dll",
    linux: uri + "libvmx_deno_ffi.so",
    freebsd: uri + "libvmx_deno_ffi.so",
    netbsd: uri + "libvmx_deno_ffi.so",
    aix: uri + "libvmx_deno_ffi.so",
    solaris: uri + "libvmx_deno_ffi.so",
    illumos: uri + "libvmx_deno_ffi.so",
  }[Deno.build.os],
  {
    add: { parameters: ["u64", "u64"], result: "u64", nonblocking: true },
    start_http_server: { parameters: [], result: "void", nonblocking: false },
  },
);

export function add(a0: bigint, a1: bigint) {
  const rawResult = symbols.add(a0, a1);
  const result = rawResult;
  return result;
}
export function start_http_server() {
  const rawResult = symbols.start_http_server();
  const result = rawResult;
  return result;
}
