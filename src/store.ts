import * as fs from "node:fs";
import * as readline from "node:readline";
import { randomUUID } from "node:crypto";
import type { IndexEntry, StoredEvent } from "./types.js";

export class EventStore {
  private index: Map<string, IndexEntry> = new Map();
  private logPath: string;

  constructor(logPath: string) {
    this.logPath = logPath;
  }

  append(payload: Record<string, unknown>): StoredEvent {
    const event: StoredEvent = {
      ...payload,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };

    const line = JSON.stringify(event) + "\n";
    const bytes = Buffer.from(line, "utf8");

    // Capture offset before writing so it matches the byte position on disk.
    let offset = 0;
    try {
      offset = fs.statSync(this.logPath).size;
    } catch {
      // File doesn't exist yet; first write starts at byte 0.
      offset = 0;
    }

    fs.appendFileSync(this.logPath, bytes);
    this.index.set(event.id, { offset, length: bytes.length });

    return event;
  }

  read(id: string): StoredEvent | null {
    const entry = this.index.get(id);
    if (!entry) return null;

    const fd = fs.openSync(this.logPath, "r");
    try {
      const buffer = Buffer.alloc(entry.length);
      fs.readSync(fd, buffer, { position: entry.offset });
      // Trim the trailing newline before parsing.
      return JSON.parse(buffer.toString("utf8").trimEnd()) as StoredEvent;
    } finally {
      fs.closeSync(fd);
    }
  }

  recover(): number {
    this.index.clear();

    if (!fs.existsSync(this.logPath)) {
      console.log("Recovered 0 events");
      return 0;
    }

    // Read the raw file as bytes so we can track exact byte offsets.
    // readline would strip the newline; we need the raw buffer for length.
    const raw = fs.readFileSync(this.logPath);
    let offset = 0;

    let lineStart = 0;
    for (let i = 0; i <= raw.length; i++) {
      // 0x0a == '\n'
      if (i === raw.length || raw[i] === 0x0a) {
        if (i > lineStart) {
          const lineBytes = raw.slice(lineStart, i + 1); // include the \n
          const lineStr = raw.slice(lineStart, i).toString("utf8");
          try {
            const event = JSON.parse(lineStr) as StoredEvent;
            if (typeof event.id === "string") {
              this.index.set(event.id, {
                offset,
                length: lineBytes.length,
              });
            }
          } catch {
            // Skip malformed lines (e.g. partial write on crash)
          }
          offset += lineBytes.length;
        } else {
          // Empty line — advance offset by 1 for the \n byte
          if (i < raw.length) offset += 1;
        }
        lineStart = i + 1;
      }
    }

    console.log(`Recovered ${this.index.size} events`);
    return this.index.size;
  }

  stats(): { total: number; bytes: number } {
    let bytes = 0;
    try {
      bytes = fs.statSync(this.logPath).size;
    } catch {
      bytes = 0;
    }
    return { total: this.index.size, bytes };
  }
}
