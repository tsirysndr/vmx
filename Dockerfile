FROM denoland/deno:latest AS builder

WORKDIR /app

COPY deno.json deno.lock ./

RUN deno install

COPY . .

RUN deno compile -A -o vmx ./main.ts

FROM ubuntu:latest

COPY --from=builder /app/vmx /usr/local/bin/vmx

RUN apt-get update && apt-get install -y \
  qemu-system-x86-64 \
  qemu-system-aarch64 \
  qemu-utils \
  genisoimage \
  curl

RUN vmx --version

ENTRYPOINT ["vmx"]
