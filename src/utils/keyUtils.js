export function encodeKey(simID, type, name) {
  // Check if any parameters are missing and throw an error if so.
  if (!simID || !type || !name) {
    throw new Error(
      `🛑 Missing parameters for encoding key for simID: ${simID}, type:${type}, name: ${name}`,
    );
  }
  return `${simID}:${type}:${name}`;
}

export function decodeKey(key) {
  // Split the key into its components
  const parts = key.split(":");
  if (parts.length !== 3) {
    throw new Error(`🛑 Invalid key format: ${key}. Expect simID.type.name`);
  }
  return {
    simID: parts[0],
    type: parts[1],
    moduleName: parts[2],
  };
}
