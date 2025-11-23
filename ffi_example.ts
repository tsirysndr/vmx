#!/usr/bin/env -S deno run --allow-ffi --allow-read

/**
 * Simple example demonstrating how to call Rust functions from TypeScript
 * using Deno FFI (Foreign Function Interface)
 *
 * Run this file with:
 *   deno run --allow-ffi --allow-read ffi_example.ts
 *
 * Or make it executable and run directly:
 *   chmod +x ffi_example.ts
 *   ./ffi_example.ts
 */

import { add, start_http_server } from "./bindings/bindings.ts";

async function main() {
  console.log("🦀 Rust FFI Example with Deno\n");

  // Example 1: Basic addition
  console.log("Example 1: Basic Addition");
  const a = 10n;
  const b = 25n;
  const sum = await add(a, b);
  console.log(`  ${a} + ${b} = ${sum}`);
  console.log();

  // Example 2: Adding larger numbers
  console.log("Example 2: Large Numbers");
  const largeA = 1_000_000n;
  const largeB = 2_500_000n;
  const largeSum = await add(largeA, largeB);
  console.log(
    `  ${largeA.toLocaleString()} + ${largeB.toLocaleString()} = ${largeSum.toLocaleString()}`,
  );
  console.log();

  // Example 3: Performance comparison
  console.log("Example 3: Performance Test");
  const iterations = 1000;

  // TypeScript addition
  const tsStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    const _ = 100n + 200n;
  }
  const tsEnd = performance.now();

  // Rust FFI addition (with async overhead)
  const rustStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    await add(100n, 200n);
  }
  const rustEnd = performance.now();

  console.log(
    `  TypeScript: ${
      (tsEnd - tsStart).toFixed(2)
    }ms for ${iterations} operations`,
  );
  console.log(
    `  Rust FFI: ${
      (rustEnd - rustStart).toFixed(2)
    }ms for ${iterations} operations`,
  );
  console.log(
    `  (Note: FFI has async overhead, but is useful for complex computations)`,
  );
  console.log();

  // Example 4: Using in a calculation
  console.log("Example 4: Practical Use Case");
  console.log("  Calculate total score: ");
  const score1 = 95n;
  const score2 = 87n;
  const score3 = 92n;

  const total1 = await add(score1, score2);
  const totalScore = await add(total1, score3);
  const average = Number(totalScore) / 3;

  console.log(`  Scores: ${score1}, ${score2}, ${score3}`);
  console.log(`  Total: ${totalScore}`);
  console.log(`  Average: ${average.toFixed(2)}`);
  console.log();

  console.log(
    "✨ Done! The Rust function was called successfully from TypeScript.",
  );

  start_http_server();
}

// Run the example
if (import.meta.main) {
  main().catch(console.error);
}
