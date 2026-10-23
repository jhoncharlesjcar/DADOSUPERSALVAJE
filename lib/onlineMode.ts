export function isOnlineModeEnabled(): boolean {
  return process.env.ONLINE_MODE_ENABLED !== "false";
}
