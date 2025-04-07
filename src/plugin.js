import BioSimObjectProvider from "./BioSimObjectProvider";
import { NAMESPACE_KEY, OBJECT_TYPES, ROOT_KEY } from "./const";

export default function installBiosimPlugin(options) {
  return function install(openmct) {
    // Register the object types.
    openmct.types.addType(OBJECT_TYPES.ROOT, {
      name: "BioSim Simulation Root",
      description: "Container for BioSim simulation instances.",
      cssClass: "icon-folder",
    });

    openmct.types.addType(OBJECT_TYPES.SIMULATION, {
      name: "BioSim Simulation Instance",
      description: "A simulation instance from BioSim",
      cssClass: "icon-telemetry",
    });

    openmct.types.addType(OBJECT_TYPES.SIM_MODULES, {
      name: "Modules",
      description: "Modules used in the simulation",
      cssClass: "icon-folder",
    });

    openmct.types.addType(OBJECT_TYPES.SIM_MODULE, {
      name: "Module",
      description: "A simulation module",
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
  };
}
