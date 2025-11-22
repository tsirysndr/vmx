import { Data } from "effect";

// API Errors
export class ImageNotFoundError extends Data.TaggedError("ImageNotFoundError")<{
  id: string;
}> {}

export class RemoveRunningVmError extends Data.TaggedError(
  "RemoveRunningVmError",
)<{
  id: string;
}> {}

export class ParseRequestError extends Data.TaggedError("ParseRequestError")<{
  cause?: unknown;
  message: string;
}> {}

// Config Errors
export class VmConfigError extends Data.TaggedError("VmConfigError")<{
  cause?: string;
}> {}

// Volume Errors
export class VolumeError extends Data.TaggedError("VolumeError")<{
  message?: unknown;
}> {}

// ORAS/Image Registry Errors
export class PushImageError extends Data.TaggedError("PushImageError")<{
  cause?: unknown;
}> {}

export class PullImageError extends Data.TaggedError("PullImageError")<{
  cause?: unknown;
}> {}

export class CreateDirectoryError extends Data.TaggedError(
  "CreateDirectoryError",
)<{
  cause?: unknown;
}> {}

export class ImageAlreadyPulledError extends Data.TaggedError(
  "ImageAlreadyPulledError",
)<{
  name: string;
}> {}

// Database Errors
export class DbError extends Data.TaggedError("DatabaseError")<{
  message?: string;
  cause?: unknown;
}> {}

export class DbQueryError extends Data.TaggedError("DbQueryError")<{
  cause?: unknown;
}> {}

// Network Errors
export class NetworkError extends Data.TaggedError("NetworkError")<{
  cause?: unknown;
}> {}

export class BridgeSetupError extends Data.TaggedError("BridgeSetupError")<{
  cause?: unknown;
}> {}

// VM Operation Errors
export class VmNotFoundError extends Data.TaggedError("VmNotFoundError")<{
  name: string;
}> {}

export class VmAlreadyRunningError extends Data.TaggedError(
  "VmAlreadyRunningError",
)<{
  name: string;
}> {}

export class StopCommandError extends Data.TaggedError("StopCommandError")<{
  vmName: string;
  exitCode: number;
  message?: string;
}> {}

export class KillQemuError extends Data.TaggedError("KillQemuError")<{
  vmName: string;
}> {}

export class CommandError extends Data.TaggedError("CommandError")<{
  cause?: unknown;
}> {}

// Log Errors
export class LogCommandError extends Data.TaggedError("LogCommandError")<{
  vmName?: string;
  exitCode?: number;
  cause?: unknown;
}> {}

// Image/File Errors
export class InvalidImageNameError extends Data.TaggedError(
  "InvalidImageNameError",
)<{
  image: string;
  cause?: unknown;
}> {}

export class NoSuchImageError extends Data.TaggedError("NoSuchImageError")<{
  cause: string;
}> {}

export class NoSuchFileError extends Data.TaggedError("NoSuchFileError")<{
  cause: string;
}> {}
