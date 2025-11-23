import { add } from "./bindings/bindings.ts";

async function main() {
  console.log("Testing Rust FFI add function from TypeScript");
  console.log("==============================================\n");

  // Test case 1: Simple addition
  const result1 = await add(2n, 3n);
  console.log(`add(2, 3) = ${result1}`);
  console.log(`Expected: 5, Got: ${result1}, Pass: ${result1 === 5n}\n`);

  // Test case 2: Larger numbers
  const result2 = await add(100n, 200n);
  console.log(`add(100, 200) = ${result2}`);
  console.log(`Expected: 300, Got: ${result2}, Pass: ${result2 === 300n}\n`);

  // Test case 3: Very large numbers
  const result3 = await add(1000000n, 2000000n);
  console.log(`add(1000000, 2000000) = ${result3}`);
  console.log(`Expected: 3000000, Got: ${result3}, Pass: ${result3 === 3000000n}\n`);

  // Test case 4: Zero
  const result4 = await add(0n, 42n);
  console.log(`add(0, 42) = ${result4}`);
  console.log(`Expected: 42, Got: ${result4}, Pass: ${result4 === 42n}\n`);

  console.log("✅ All tests completed!");
}

main().catch(console.error);
