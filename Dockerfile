FROM denoland/deno:latest AS builder

WORKDIR /app

COPY deno.json deno.lock ./

RUN deno install

COPY . .

RUN deno compile -A -o vmx ./main.ts

FROM ubuntu:latest

COPY --from=builder /app/vmx /usr/local/bin/vmx

RUN vmx --version

ENTRYPOINT ["vmx"]
