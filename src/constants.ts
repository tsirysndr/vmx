export const CONFIG_DIR: string = `${Deno.env.get("HOME")}/.vmx`;
export const DB_PATH: string = `${CONFIG_DIR}/state.sqlite`;
export const LOGS_DIR: string = `${CONFIG_DIR}/logs`;
export const EMPTY_DISK_THRESHOLD_KB: number = 100;
export const CONFIG_FILE_NAME: string = "vmconfig.toml";
export const IMAGE_DIR: string = `${CONFIG_DIR}/images`;
export const VOLUME_DIR: string = `${CONFIG_DIR}/volumes`;

export const UBUNTU_ISO_URL: string = Deno.build.arch === "aarch64"
  ? "https://cdimage.ubuntu.com/releases/24.04/release/ubuntu-24.04.3-live-server-arm64.iso"
  : "https://releases.ubuntu.com/24.04.3/ubuntu-24.04.3-live-server-amd64.iso";

export const FEDORA_COREOS_DEFAULT_VERSION: string = "43.20251024.3.0";
export const FEDORA_COREOS_IMG_URL: string =
  `https://builds.coreos.fedoraproject.org/prod/streams/stable/builds/${FEDORA_COREOS_DEFAULT_VERSION}/${Deno.build.arch}/fedora-coreos-${FEDORA_COREOS_DEFAULT_VERSION}-qemu.${Deno.build.arch}.qcow2.xz`;

export const NIXOS_DEFAULT_VERSION: string = "25.05";
export const NIXOS_ISO_URL: string =
  `https://channels.nixos.org/nixos-${NIXOS_DEFAULT_VERSION}/latest-nixos-minimal-${Deno.build.arch}-linux.iso`;

export const FEDORA_IMG_URL: string =
  `https://download.fedoraproject.org/pub/fedora/linux/releases/43/Server/${Deno.build.arch}/images/Fedora-Server-Guest-Generic-43-1.6.${Deno.build.arch}.qcow2`;

export const GENTOO_IMG_URL: string = Deno.build.arch === "aarch64"
  ? "https://distfiles.gentoo.org/releases/arm64/autobuilds/20251116T233105Z/di-arm64-console-20251116T233105Z.qcow2"
  : "https://distfiles.gentoo.org/releases/amd64/autobuilds/20251116T161545Z/di-amd64-console-20251116T161545Z.qcow2";

export const DEBIAN_DEFAULT_VERSION: string = "13.2.0";

export const DEBIAN_ISO_URL: string = Deno.build.arch === "aarch64"
  ? `https://cdimage.debian.org/debian-cd/current/arm64/iso-cd/debian-${DEBIAN_DEFAULT_VERSION}-arm64-netinst.iso`
  : `https://cdimage.debian.org/debian-cd/current/amd64/iso-cd/debian-${DEBIAN_DEFAULT_VERSION}-amd64-netinst.iso`;

export const ALPINE_DEFAULT_VERSION: string = "3.22.2";

export const ALPINE_ISO_URL: string = Deno.build.arch === "aarch64"
  ? `https://dl-cdn.alpinelinux.org/alpine/v${
    ALPINE_DEFAULT_VERSION.split(
      ".",
    )
      .slice(0, 2)
      .join(".")
  }/releases/cloud/generic_alpine-${ALPINE_DEFAULT_VERSION}-${Deno.build.arch}-uefi-tiny-r0.qcow2`
  : `https://dl-cdn.alpinelinux.org/alpine/v${
    ALPINE_DEFAULT_VERSION.split(
      ".",
    )
      .slice(0, 2)
      .join(".")
  }/releases/cloud/generic_alpine-${ALPINE_DEFAULT_VERSION}-${Deno.build.arch}-uefi-tiny-r0.qcow2`;

export const DEBIAN_CLOUD_IMG_URL: string = Deno.build.arch === "aarch64"
  ? "https://cdimage.debian.org/images/cloud/trixie/20251117-2299/debian-13-generic-arm64-20251117-2299.qcow2"
  : "https://cdimage.debian.org/images/cloud/trixie/20251117-2299/debian-13-generic-amd64-20251117-2299.qcow2";

export const UBUNTU_CLOUD_IMG_URL: string = Deno.build.arch === "aarch64"
  ? "https://cloud-images.ubuntu.com/noble/current/noble-server-cloudimg-arm64.img"
  : "https://cloud-images.ubuntu.com/noble/current/noble-server-cloudimg-amd64.img";

export const ALMA_LINUX_IMG_URL: string = Deno.build.arch === "aarch64"
  ? "https://repo.almalinux.org/almalinux/10/cloud/aarch64/images/AlmaLinux-10-GenericCloud-latest.aarch64.qcow2"
  : "https://repo.almalinux.org/almalinux/10/cloud/x86_64/images/AlmaLinux-10-GenericCloud-latest.x86_64.qcow2";

export const ROCKY_LINUX_IMG_URL: string = Deno.build.arch === "aarch64"
  ? "https://dl.rockylinux.org/pub/rocky/9/images/aarch64/Rocky-9-GenericCloud.latest.aarch64.qcow2"
  : "https://dl.rockylinux.org/pub/rocky/9/images/x86_64/Rocky-9-GenericCloud.latest.x86_64.qcow2";
