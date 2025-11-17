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
