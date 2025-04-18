export const NAMESPACE_KEY = "biosim";
export const OBJECT_TYPES = {
  SIMULATION: `${NAMESPACE_KEY}.sim`,
  GLOBALS: `${NAMESPACE_KEY}.sim.globals`,
  GLOBALS_METADATUM: `${NAMESPACE_KEY}.sim.globals.metadatum`,
  STORE: `${NAMESPACE_KEY}.sim.modules.store`,
  STORE_TELEMETRY: `${NAMESPACE_KEY}.sim.modules.store.telemetry`,
  ACTIVE_MODULE: `${NAMESPACE_KEY}.sim.modules.module`,
  CONSUMER: `${NAMESPACE_KEY}.sim.modules.consumer`,
  CONSUMER_TELEMETRY: `${NAMESPACE_KEY}.sim.modules.consumer.telemetry`,
  PRODUCER: `${NAMESPACE_KEY}.sim.modules.producer`,
  PRODUCER_TELEMETRY: `${NAMESPACE_KEY}.sim.modules.producer.telemetry`,
  ENVIRONMENT: `${NAMESPACE_KEY}.sim.modules.environment`,
  ENVIRONMENT_TELEMETRY: `${NAMESPACE_KEY}.sim.modules.environment.telemetry`,
  CREW: `${NAMESPACE_KEY}.sim.modules.crew`,
  CREW_MEMBER: `${NAMESPACE_KEY}.sim.modules.crew.member`,
  CREW_MEMBER_TELEMETRY: `${NAMESPACE_KEY}.sim.modules.crew.member.telemetry`,
  SENSOR: `${NAMESPACE_KEY}.sim.modules.sensor`,
  ACTUATOR: `${NAMESPACE_KEY}.sim.modules.actuator`,
};

export const ROOT_KEY = `${NAMESPACE_KEY}.root`;
