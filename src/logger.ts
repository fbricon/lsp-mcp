import { Logger } from "vscode-jsonrpc";
import * as fs from "fs";

export interface DisposableLogger extends Logger {
  dispose(): Promise<void>;
}

function formatMessage(message: string) {
  if (!message.endsWith("\n")) {
    message += "\n";
  }

  return message;
}

export const errorLogger: Logger = {
  error: (message: string) => {
    console.error(formatMessage(message));
  },
  warn: (message: string) => {
    console.warn(formatMessage(message));
  },
  info: (message: string) => {
    console.info(formatMessage(message));
  },
  log: (message: string) => {
    console.log(formatMessage(message));
  },
};

export const consoleLogger: Logger = {
  error: (message: string) => {
    console.error(formatMessage(message));
  },
  warn: (message: string) => {
    console.warn(formatMessage(message));
  },
  info: (message: string) => {
    console.info(formatMessage(message));
  },
  log: (message: string) => {
    console.log(formatMessage(message));
  },
};

export const nullLogger: Logger = {
  error: (message: string) => {
  },
  warn: (message: string) => {
  },
  info: (message: string) => {
  },
  log: (message: string) => {
  },
};

export function createFileLogger(logFile: string): DisposableLogger {
  const logStream = fs.createWriteStream(logFile, { flags: 'a' });

  return {
    error: (message: string) => {
      logStream.write(formatMessage(message));
    },
    warn: (message: string) => {
      logStream.write(formatMessage(message));
    },
    info: (message: string) => {
      logStream.write(formatMessage(message));
    },
    log: (message: string) => {
      logStream.write(formatMessage(message));
    },
    dispose: async () => {
      return new Promise((resolve) => {
        logStream.end(resolve);
      });
    },
  };
}
