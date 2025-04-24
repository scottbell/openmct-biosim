export function encodeKey(parent, name) {
  const parentKey = parent?.identifier.key;
  // Check if any parameters are missing and throw an error if so.
  if (!parentKey || !name) {
    throw new Error(
      `🛑 Missing parameters for encoding key, parent key: ${parentKey}, name: ${name}`,
    );
  }
  return `${parentKey}:${name}`;
}

export function decodeKey(key) {
  const parts = key.split(":");
  if (parts.length < 2) {
    throw new Error(
      `🛑 Invalid key format: ${key}. Expected format with at least one parent and a name (e.g., parent:name)`,
    );
  }
  // The last part is always the name, while the rest form the parent key.
  const name = parts.pop();
  return { name };
}
