# VMX Deno FFI

This crate provides FFI bindings for calling Rust functions from Deno/TypeScript using `deno_bindgen`.

## Setup

### Prerequisites

- Rust (with Cargo)
- Deno 2.0+
- deno_bindgen CLI (optional, for regenerating bindings)

### Building

To build the Rust library:

```bash
# Using the Deno task (recommended - handles cross-platform builds)
deno task build:ffi

# Or manually with cargo
cargo build --release -p vmx-deno-ffi
```

This will generate the dynamic library at:
- macOS: `target/release/libvmx_deno_ffi.dylib`
- Linux: `target/release/libvmx_deno_ffi.so`
- Windows: `target/release/vmx_deno_ffi.dll`

### TypeScript Bindings

The TypeScript bindings are located in `bindings/bindings.ts` at the project root. 

**The `deno task build:ffi` command automatically:**
1. Builds the Rust library for your platform (macOS, Linux, or Windows)
2. Attempts to generate TypeScript bindings with `deno_bindgen_cli`
3. If bindings generation fails, it uses existing bindings or creates a template
4. Fixes the library path to use the release build
5. Ensures bindings are in the correct location

**Note:** Due to how `deno_bindgen` works, the bindings may not always be auto-generated. The build script is designed to handle this gracefully by:
- Using existing bindings if they're already present
- Creating a template bindings file if none exist
- Always ensuring the Rust library is properly compiled

If you add new functions, you'll need to manually update `bindings/bindings.ts` to include them (see "Adding New Functions" below).

## Usage

### From TypeScript

```typescript
import { add } from "./bindings/bindings.ts";

// Note: The function returns a Promise and uses BigInt for u64 types
const result = await add(2n, 3n);
console.log(result); // 5n
```

### Running Tests

```bash
deno task test:ffi
```

Or with explicit permissions:

```bash
deno run --allow-ffi --allow-read test_ffi.ts
```

## Adding New Functions

1. Add your function to `src/lib.rs` with the `#[deno_bindgen]` attribute:

```rust
use deno_bindgen::deno_bindgen;

#[deno_bindgen]
pub fn multiply(left: u64, right: u64) -> u64 {
    left * right
}
```

2. Rebuild the library:
```bash
deno task build:ffi
```

3. Update the bindings manually in `bindings/bindings.ts`. Add your function to the FFI symbols definition:
```typescript
const { symbols } = Deno.dlopen(
  {
    darwin: uri + "libvmx_deno_ffi.dylib",
    windows: uri + "vmx_deno_ffi.dll",
    linux: uri + "libvmx_deno_ffi.so",
    // ... other platforms
  }[Deno.build.os],
  {
    add: { parameters: ["u64", "u64"], result: "u64", nonblocking: true },
    multiply: { parameters: ["u64", "u64"], result: "u64", nonblocking: false }, // Add this line
  },
);
```

4. Export the TypeScript wrapper function:
```typescript
export function multiply(a0: bigint, a1: bigint): bigint {
  return symbols.multiply(a0, a1) as bigint;
}
```

5. Use from TypeScript:
```typescript
import { multiply } from "./bindings/bindings.ts";

const result = await multiply(5n, 10n);
console.log(result); // 50n
```

## Type Mapping

| Rust Type | TypeScript Type |
|-----------|----------------|
| `u8`, `u16`, `u32` | `number` |
| `u64`, `i64` | `bigint` |
| `f32`, `f64` | `number` |
| `bool` | `boolean` |
| `String` | `string` |
| `Vec<u8>` | `Uint8Array` |

## Non-Blocking Functions

Functions marked with `#[deno_bindgen(non_blocking)]` will be executed asynchronously and return a Promise:

```rust
#[deno_bindgen(non_blocking)]
pub fn expensive_operation(input: u64) -> u64 {
    // Long-running computation
    input * 2
}
```

```typescript
// Returns Promise<bigint>
const result = await expensive_operation(1000n);
```

## Troubleshooting

### Library not found error

Make sure you've built the library:
```bash
deno task build:ffi
```

### Wrong architecture error

Ensure you're building for the correct architecture. On Apple Silicon Macs, you may need to explicitly specify:
```bash
cargo build --release --target aarch64-apple-darwin -p vmx-deno-ffi
```

### Permission errors

Deno requires explicit permissions for FFI:
```bash
deno run --allow-ffi --allow-read your_script.ts
```

## License

MPL-2.0