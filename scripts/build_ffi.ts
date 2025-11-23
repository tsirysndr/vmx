#!/usr/bin/env -S deno run --allow-run --allow-read --allow-write

/**
 * Build script for vmx-deno-ffi
 * Compiles the Rust library and generates TypeScript bindings
 */

const libName = "vmx_deno_ffi";

// Determine the library file name based on the OS
const getLibFileName = () => {
    switch (Deno.build.os) {
        case "darwin":
            return `lib${libName}.dylib`;
        case "windows":
            return `${libName}.dll`;
        case "linux":
        case "freebsd":
        case "netbsd":
        case "aix":
        case "solaris":
        case "illumos":
            return `lib${libName}.so`;
        default:
            throw new Error(`Unsupported OS: ${Deno.build.os}`);
    }
};

const libFileName = getLibFileName();

console.log("🔨 Building Rust FFI library...");

// Step 1: Build the Rust library
const buildProcess = new Deno.Command("cargo", {
    args: ["build", "--release", "-p", libName.replace(/_/g, "-")],
    stdout: "inherit",
    stderr: "inherit",
});

const buildResult = await buildProcess.output();

if (!buildResult.success) {
    console.error("❌ Failed to build Rust library");
    Deno.exit(1);
}

console.log("✅ Rust library built successfully");

// Check if the library file exists
const libPath = `./target/release/${libFileName}`;
try {
    await Deno.stat(libPath);
} catch {
    console.error(`❌ Library file not found: ${libPath}`);
    Deno.exit(1);
}

console.log("\n📦 Generating TypeScript bindings...");

// Step 2: Try to generate bindings with deno_bindgen_cli
const bindgenProcess = new Deno.Command("deno_bindgen_cli", {
    args: ["-r", `../../target/release/${libFileName}`],
    cwd: "./crates/vmx-deno-ffi",
    stdout: "piped",
    stderr: "piped",
});

const bindgenResult = await bindgenProcess.output();

// Step 3: Ensure the bindings directory exists
await Deno.mkdir("./bindings", { recursive: true });

// Check if bindings were generated
const bindingsPath = "./crates/vmx-deno-ffi/bindings/bindings.ts";
const destBindingsPath = "./bindings/bindings.ts";

let bindingsGenerated = false;
try {
    await Deno.stat(bindingsPath);
    bindingsGenerated = true;
} catch {
    bindingsGenerated = false;
}

if (bindingsGenerated) {
    console.log("✅ Bindings generated");
    console.log("\n🔧 Fixing generated bindings path...");

    // Fix the path in the generated bindings
    let bindingsContent = await Deno.readTextFile(bindingsPath);

    // Replace the incorrect path with the correct one
    bindingsContent = bindingsContent.replace(
        /const url = new URL\(".*?", import\.meta\.url\)/,
        'const url = new URL("../target/release", import.meta.url)',
    );

    await Deno.writeTextFile(bindingsPath, bindingsContent);

    console.log("✅ Path fixed");
    console.log("\n📋 Copying bindings to project root...");

    // Copy bindings to the project root
    await Deno.copyFile(bindingsPath, destBindingsPath);

    console.log("✅ Bindings copied");
} else {
    console.log("⚠️  deno_bindgen_cli did not generate bindings");
    console.log("   This can happen if the library metadata is not embedded.");

    // Check if we have existing bindings
    try {
        await Deno.stat(destBindingsPath);
        console.log("✅ Using existing bindings at bindings/bindings.ts");
        console.log(
            "   (You may need to update them manually if you changed function signatures)",
        );
    } catch {
        console.error("\n❌ No bindings found!");
        console.error("   Creating template bindings file...");

        // Create a template bindings file
        const templateBindings = `// Auto-generated with deno_bindgen
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
  uri = uri.replace(/\\//g, "\\\\");
  // Remove leading slash
  if (uri.startsWith("\\\\")) {
    uri = uri.slice(1);
  }
}

const { symbols } = Deno.dlopen(
  {
    darwin: uri + "lib${libName}.dylib",
    windows: uri + "${libName}.dll",
    linux: uri + "lib${libName}.so",
    freebsd: uri + "lib${libName}.so",
    netbsd: uri + "lib${libName}.so",
    aix: uri + "lib${libName}.so",
    solaris: uri + "lib${libName}.so",
    illumos: uri + "lib${libName}.so",
  }[Deno.build.os],
  {
    add: { parameters: ["u64", "u64"], result: "u64", nonblocking: true },
  },
);

export function add(a0: bigint, a1: bigint): Promise<bigint> {
  const rawResult = symbols.add(a0, a1);
  return rawResult as Promise<bigint>;
}

export function start_http_server() {
  const rawResult = symbols.start_http_server();
  const result = rawResult;
  return result;
  return rawResult as Promise<bigint>;
}
`;

        await Deno.writeTextFile(destBindingsPath, templateBindings);
        console.log("✅ Template bindings created");
        console.log(
            "   Note: You may need to update function signatures manually if they change",
        );
    }
}

console.log("\n🎉 Build completed successfully!");
console.log(`\n📚 Library: target/release/${libFileName}`);
console.log("📚 Bindings: bindings/bindings.ts");
console.log("\n▶️  Run tests with: deno task test:ffi");
