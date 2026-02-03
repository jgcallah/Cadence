/**
 * Checks if a value is a plain object (not an array, null, or other type).
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === "[object Object]"
  );
}

/**
 * Merges frontmatter objects with deep merge support.
 *
 * - Existing fields not in updates are preserved
 * - Updates override existing fields
 * - Nested objects are merged recursively
 * - Arrays are replaced entirely (not merged)
 * - Undefined values in updates are ignored
 */
export class FrontmatterMerger {
  /**
   * Merges updates into existing frontmatter.
   *
   * @param existing - The existing frontmatter object
   * @param updates - The updates to apply
   * @returns A new merged frontmatter object (does not mutate inputs)
   */
  merge(
    existing: Record<string, unknown>,
    updates: Record<string, unknown>
  ): Record<string, unknown> {
    return this.deepMerge(existing, updates);
  }

  /**
   * Recursively performs a deep merge of two objects.
   */
  private deepMerge(
    target: Record<string, unknown>,
    source: Record<string, unknown>
  ): Record<string, unknown> {
    // Start with a shallow copy of target
    const result: Record<string, unknown> = { ...target };

    for (const key of Object.keys(source)) {
      const sourceValue = source[key];
      const targetValue = result[key];

      // Skip undefined values in source - they shouldn't override existing values
      if (sourceValue === undefined) {
        continue;
      }

      // If both values are plain objects, merge them recursively
      if (isPlainObject(sourceValue) && isPlainObject(targetValue)) {
        result[key] = this.deepMerge(targetValue, sourceValue);
      } else {
        // Otherwise, the source value overwrites the target value
        // This includes: primitives, arrays, null, or type mismatches
        result[key] = this.deepClone(sourceValue);
      }
    }

    return result;
  }

  /**
   * Creates a deep clone of a value to prevent mutation of input objects.
   */
  private deepClone(value: unknown): unknown {
    if (value === null || typeof value !== "object") {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.deepClone(item));
    }

    if (isPlainObject(value)) {
      const cloned: Record<string, unknown> = {};
      for (const key of Object.keys(value)) {
        cloned[key] = this.deepClone(value[key]);
      }
      return cloned;
    }

    // For other object types (Date, etc.), return as-is
    return value;
  }
}
