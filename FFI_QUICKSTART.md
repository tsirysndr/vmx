# Deno FFI with Rust - Quick Start Guide

This guide will help you get started with calling Rust functions from TypeScript using Deno's FFI (Foreign Function Interface).

## 🚀 Quick Start

### 1. Build the Rust Library

```bash
deno task build:ffi
```

This command will:
- Compile the Rust library (`vmx-deno-ffi`)
- Attempt to generate TypeScript bindings (or use existing ones)
- Set up everything for cross-platform use (macOS, Linux, Windows)
- Create template bindings if none exist

### 2. Use in Your TypeScript Code

```typescript
import { add } from "./bindings/bindings.ts";

// Call the Rust function (returns a Promise)
const result = await add(2n, 3n);
console.log(result); // 5n
```

**Important:** Use `BigInt` (with `n` suffix) for `u64` types!

### 3. Run Your Code

```bash
deno run --allow-ffi --allow-read your_script.ts
```

### 4. Test the Setup

```bash
deno task test:ffi
```

## 📁 Project Structure

```
vmx/
├── crates/
│   └── vmx-deno-ffi/          # Rust FFI library
│       ├── src/
│       │   └── lib.rs         # Rust functions
│       └── Cargo.toml
├── bindings/
│   └── bindings.ts            # Generated TypeScript bindings
├── scripts/
│   └── build_ffi.ts           # Build automation script
├── test_ffi.ts                # Test suite
└── ffi_example.ts             # Usage examples
```

## 📝 Examples

### Example 1: Simple Usage

```typescript
import { add } from "./bindings/bindings.ts";

const sum = await add(100n, 200n);
console.log(`Result: ${sum}`); // Result: 300
```

### Example 2: In a Function

```typescript
import { add } from "./bindings/bindings.ts";

async function calculateTotal(prices: bigint[]): Promise<bigint> {
  let total = 0n;
  for (const price of prices) {
    total = await add(total, price);
  }
  return total;
}

const total = await calculateTotal([10n, 20n, 30n]);
console.log(total); // 60n
```

## ➕ Adding New Functions

### Step 1: Add to Rust (`crates/vmx-deno-ffi/src/lib.rs`)

```rust
use deno_bindgen::deno_bindgen;

#[deno_bindgen]
pub fn multiply(a: u64, b: u64) -> u64 {
    a * b
}

// For async/non-blocking operations
#[deno_bindgen(non_blocking)]
pub fn expensive_calculation(n: u64) -> u64 {
    // Your complex computation here
    n * 2
}
```

### Step 2: Rebuild the Rust Library

```bash
deno task build:ffi
```

### Step 3: Update TypeScript Bindings (`bindings/bindings.ts`)

Add your new functions to the FFI symbols and export them:

```typescript
const { symbols } = Deno.dlopen(
  // ... platform config ...
  {
    add: { parameters: ["u64", "u64"], result: "u64", nonblocking: true },
    multiply: { parameters: ["u64", "u64"], result: "u64", nonblocking: false },
    expensive_calculation: { parameters: ["u64"], result: "u64", nonblocking: true },
  },
);

export function multiply(a0: bigint, a1: bigint): bigint {
  return symbols.multiply(a0, a1) as bigint;
}

export function expensive_calculation(n: bigint): Promise<bigint> {
  const rawResult = symbols.expensive_calculation(n);
  return rawResult as Promise<bigint>;
}
```

### Step 4: Use in TypeScript

```typescript
import { multiply, expensive_calculation } from "./bindings/bindings.ts";

// Synchronous-style function
const product = multiply(5n, 10n);

// Explicitly non-blocking function (returns Promise)
const result = await expensive_calculation(1000n);
```

## 🔧 Available Commands

| Command | Description |
|---------|-------------|
| `deno task build:ffi` | Build Rust library and generate bindings |
| `deno task test:ffi` | Run FFI tests |
| `deno run --allow-ffi --allow-read your_script.ts` | Run your script with FFI permissions |

## 📊 Type Mapping Reference

| Rust Type | TypeScript Type | Example |
|-----------|----------------|---------|
| `u8`, `u16`, `u32` | `number` | `42` |
| `u64`, `i64` | `bigint` | `42n` |
| `f32`, `f64` | `number` | `3.14` |
| `bool` | `boolean` | `true` |
| `String` | `string` | `"hello"` |
| `Vec<u8>` | `Uint8Array` | `new Uint8Array([1, 2, 3])` |

## ⚠️ Common Gotchas

### 1. Always Use BigInt for u64/i64

```typescript
// ❌ Wrong
await add(2, 3);

// ✅ Correct
await add(2n, 3n);
```

### 2. Functions Return Promises

```typescript
// ❌ Wrong
const result = add(2n, 3n);

// ✅ Correct
const result = await add(2n, 3n);
```

### 3. Required Permissions

```bash
# ❌ Will fail with permission error
deno run your_script.ts

# ✅ Correct - include necessary permissions
deno run --allow-ffi --allow-read your_script.ts
```

## 🐛 Troubleshooting

### "Library not found" Error

**Solution:** Build the library first
```bash
deno task build:ffi
```

### "Permission denied" Error

**Solution:** Add required permissions
```bash
deno run --allow-ffi --allow-read your_script.ts
```

### Type Mismatch Errors

**Solution:** Ensure you're using the correct types (especially `bigint` for u64)

## 📚 Learn More

- Run the examples: `deno run --allow-ffi --allow-read ffi_example.ts`
- Read the detailed README: `crates/vmx-deno-ffi/README.md`
- Deno FFI documentation: https://docs.deno.com/runtime/manual/runtime/ffi_api
- deno_bindgen: https://github.com/denoland/deno_bindgen

## ✨ Tips

1. **Use FFI for CPU-intensive tasks** - Rust's performance shines for heavy computations
2. **Non-blocking by default** - Functions marked with `#[deno_bindgen(non_blocking)]` return Promises and won't block the event loop
3. **Type safety** - The bindings provide TypeScript types automatically
4. **Cross-platform** - The build script handles different OS library formats
5. **Manual bindings** - When adding new functions, you'll need to update `bindings/bindings.ts` manually

## 🔄 Build Process Note

The build script attempts to auto-generate bindings with `deno_bindgen_cli`, but this may not always work due to how metadata is embedded. The script is designed to:
- Use existing bindings if generation fails
- Create a template if no bindings exist
- Always compile the Rust library successfully

This is a known limitation of the current `deno_bindgen` setup and doesn't affect functionality.

Happy coding! 🦕🦀