import { NAMESPACE_KEY, OBJECT_TYPES, ROOT_KEY } from "./const";
import BioSimObjectProvider from "./providers/ObjectProvider";
import RealtimeTelemetryProvider from "./providers/RealtimeTelemetryProvider";

export default function installBiosimPlugin(options) {
  return function install(openmct) {
    // Register the object types.
    openmct.types.addType(ROOT_KEY, {
      name: "BioSim Simulation Root",
      description: "Container for BioSim simulation instances.",
      cssClass: "icon-folder",
    });

    openmct.types.addType(OBJECT_TYPES.SIMULATION, {
      name: "BioSim Simulation Instance",
      description: "A simulation instance from BioSim",
      cssClass: "icon-folder",
    });

    openmct.types.addType(OBJECT_TYPES.GLOBALS, {
      name: "Simulation Globals",
      description: "Global settings for the simulation instance",
      cssClass: "icon-folder",
    });

    openmct.types.addType(OBJECT_TYPES.STORE, {
      name: "Store Module",
      description: "A store module that contains resources",
      cssClass: "icon-folder",
    });

    openmct.types.addType(OBJECT_TYPES.ACTIVE_MODULE, {
      name: "Active Module",
      description: "An active module that produces and consumes resources",
      cssClass: "icon-folder",
    });

    openmct.types.addType(OBJECT_TYPES.ENVIRONMENT, {
      name: "Environment",
      description: "An environmental module that contains a mix of gases",
      cssClass: "icon-folder",
    });

    openmct.types.addType(OBJECT_TYPES.CONSUMER, {
      name: "Consumer",
      description: "A module's consumption details",
      cssClass: "icon-folder",
    });

    openmct.types.addType(OBJECT_TYPES.PRODUCER, {
      name: "Producer",
      description: "A module's production details",
      cssClass: "icon-folder",
    });

    openmct.types.addType(OBJECT_TYPES.CREW, {
      name: "Crew",
      description: "A crew module that contains crew members",
      cssClass: "icon-folder",
    });

    openmct.types.addType(OBJECT_TYPES.SENSOR, {
      name: "Sensor",
      description: "A sensor module from the simulation",
      cssClass: "icon-folder",
    });

    openmct.types.addType(OBJECT_TYPES.ACTUATOR, {
      name: "Actuator",
      description: "An cctuator module from the simulation",
      cssClass: "icon-folder",
    });

    openmct.types.addType(OBJECT_TYPES.TELEMETRY, {
      name: "Simulation Telemetry",
      description: "Telemetry data produced by the simulation",
      cssClass: "icon-telemetry",
    });

    openmct.objects.addRoot({
      namespace: NAMESPACE_KEY,
      key: ROOT_KEY,
    });

    openmct.objects.addProvider(
      NAMESPACE_KEY,
      new BioSimObjectProvider(options),
    );

    const realTimeTelemetryProvider = new RealtimeTelemetryProvider(options);

    openmct.telemetry.addProvider(realTimeTelemetryProvider);
  };
}
