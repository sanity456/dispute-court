// Replace only parameter markers, never question marks inside quoted SQL or comments.
export function postgresParameters(sql: string) {
  let output = "",
    index = 0,
    i = 0;
  while (i < sql.length) {
    const char = sql[i];
    if (char === "'" || char === '"') {
      const quote = char;
      output += char;
      i++;
      let closed = false;
      while (i < sql.length) {
        const next = sql[i++];
        output += next;
        if (next === quote) {
          if (sql[i] === quote) output += sql[i++];
          else {
            closed = true;
            break;
          }
        }
      }
      if (!closed) throw new Error("Unterminated SQL quote.");
    } else if (sql.slice(i, i + 2) === "--") {
      const end = sql.indexOf("\n", i);
      const stop = end < 0 ? sql.length : end + 1;
      output += sql.slice(i, stop);
      i = stop;
    } else if (sql.slice(i, i + 2) === "/*") {
      const end = sql.indexOf("*/", i + 2);
      if (end < 0) throw new Error("Unterminated SQL comment.");
      output += sql.slice(i, end + 2);
      i = end + 2;
    } else if (char === "$") {
      const tag = sql.slice(i).match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/)?.[0];
      if (tag) {
        const end = sql.indexOf(tag, i + tag.length);
        if (end < 0) throw new Error("Unterminated SQL dollar quote.");
        output += sql.slice(i, end + tag.length);
        i = end + tag.length;
      } else {
        output += char;
        i++;
      }
    } else {
      output += char === "?" ? "$" + ++index : char;
      i++;
    }
  }
  return { sql: output, count: index };
}
