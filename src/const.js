export const NAMESPACE_KEY = "biosim";
export const OBJECT_TYPES = {
  SIMULATION: `${NAMESPACE_KEY}.sim`,
  GLOBALS: `${NAMESPACE_KEY}.sim.globals`,
  STORE: `${NAMESPACE_KEY}.sim.modules.store`,
  ACTIVE_MODULE: `${NAMESPACE_KEY}.sim.modules.module`,
  CONSUMER: `${NAMESPACE_KEY}.sim.modules.consumer`,
  PRODUCER: `${NAMESPACE_KEY}.sim.modules.producer`,
  ENVIRONMENT: `${NAMESPACE_KEY}.sim.modules.environment`,
  CREW: `${NAMESPACE_KEY}.sim.modules.crew`,
  SENSOR: `${NAMESPACE_KEY}.sim.modules.sensor`,
  ACTUATOR: `${NAMESPACE_KEY}.sim.modules.actuator`,
  TELEMETRY: `${NAMESPACE_KEY}.telemetry`,
};

export const ROOT_KEY = `${NAMESPACE_KEY}.root`;
