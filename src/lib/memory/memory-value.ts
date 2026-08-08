/**
 * Read a structured memory out of `agent_memories.value`.
 *
 * `value` is a TEXT column. Every row comes back as a string — prose memories
 * as prose, structured ones as a string of JSON. Code that wrote an object and
 * assumed it would read one back gets `undefined` for every field, silently,
 * with no error anywhere.
 *
 * That single mistake disabled three separate features for as long as they
 * have existed:
 *
 *  - the thread boundary, so "Start fresh" cleared the screen and the next
 *    refresh restored the entire argument;
 *  - the correction tally, so "you keep misspelling this" never counted past
 *    zero and the brand name kept coming back wrong;
 *  - reaction learning, so every 👍 and 👎 was recorded and never read.
 *
 * None of them threw. They just quietly did nothing, which is the expensive
 * kind of broken — the owner reports it as "it has no memory" and the logs are
 * clean.
 *
 * Both shapes are accepted rather than the data being migrated: rows written
 * in either form must keep working, and a parse is cheaper than a backfill.
 */
export function parseMemoryValue<T>(value: unknown): T | null {
  if (value == null) return null

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      // Prose memories are strings of prose, not JSON. `JSON.parse('"hi"')`
      // succeeds and yields a string, which is not a record — say so rather
      // than handing back something the caller will read fields off.
      return parsed !== null && typeof parsed === 'object' ? (parsed as T) : null
    } catch {
      return null
    }
  }

  return typeof value === 'object' ? (value as T) : null
}
