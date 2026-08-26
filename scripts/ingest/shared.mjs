import fs from "node:fs";

// Both source .txt files have flipped between UTF-8 and UTF-16 (Excel
// re-saves) across edits, so every reader auto-detects via BOM.
export function parseTsv(filePath) {
  const buf = fs.readFileSync(filePath);
  const isUtf16LE = buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe;
  const isUtf16BE = buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff;
  let text;
  if (isUtf16LE) {
    text = buf.slice(2).toString("utf16le");
  } else if (isUtf16BE) {
    const swapped = Buffer.from(buf.slice(2));
    for (let i = 0; i < swapped.length - 1; i += 2) {
      const tmp = swapped[i];
      swapped[i] = swapped[i + 1];
      swapped[i + 1] = tmp;
    }
    text = swapped.toString("utf16le");
  } else {
    text = buf.toString("utf8").replace(/^﻿/, "");
  }
  const lines = text.trim().split(/\r\n|\r|\n/);
  const headers = lines[0].split("\t");
  return lines.slice(1).map((line) => {
    const cells = line.split("\t");
    return Object.fromEntries(headers.map((h, i) => [h, cells[i]]));
  });
}
