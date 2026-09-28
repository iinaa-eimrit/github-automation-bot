type LogLevel = "info" | "warn" | "error";

export function log(
  level: LogLevel,
  message: string,
  context: Record<string, unknown> = {}
): void {
  const line = JSON.stringify({
    level,
    message,
    timestamp: new Date().toISOString(),
    ...context,
  });

  if (level === "error") {
    console.error(line);
  } else {
    console.log(line);
  }
}
