type LogLevel = "error" | "warn" | "info" | "debug";

export const pastLogs: { level: LogLevel, message: string }[] = Array.from({length: 100});

function pushLog(level: LogLevel, ...args: unknown[]): void {
  pastLogs.shift();
  pastLogs.push({
    level,
    message: args.map((v) => {
      if (typeof v === "string") {
        return v;
      }
      try {
        return JSON.stringify(v);
      } catch {
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        return v?.toString();
      }
    }).join(", "),
  });
};

export function debug(...args: unknown[]): void {
  console.debug("WCE", `${window.FBC_VERSION}:`, ...args);
  pushLog("debug", ...args);
};

export function logInfo(...args: unknown[]): void {
  console.info("WCE", `${window.FBC_VERSION}:`, ...args);
  pushLog("info", ...args);
};

export function logWarn(...args: unknown[]): void {
  console.warn("WCE", `${window.FBC_VERSION}:`, ...args);
  pushLog("warn", ...args);
};

export function logError(...args: unknown[]): void {
  console.error("WCE", `${window.FBC_VERSION}:`, ...args);
  pushLog("error", ...args);
};
