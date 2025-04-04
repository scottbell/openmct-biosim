import BioSimObjectProvider from "./BioSimObjectProvider";

export default function installBiosimPlugin(options) {
  return function install(openmct) {
    // Register the object types.
    openmct.types.addType("biosim.root", {
      name: "BioSim Simulation Root",
      description: "Container for BioSim simulation instances.",
      cssClass: "icon-folder",
    });

    openmct.types.addType("biosim.sim", {
      name: "BioSim Simulation Instance",
      description: "A simulation instance from BioSim",
      cssClass: "icon-simulation",
    });

    openmct.types.addType("biosim.sim.modules", {
      name: "Modules",
      description: "Modules used in the simulation",
      cssClass: "icon-dictionary",
    });

    openmct.types.addType("biosim.sim.globals", {
      name: "Globals",
      description: "Global simulation settings from BioSim",
      cssClass: "icon-telemetry",
    });

    openmct.objects.addProvider("biosim", new BioSimObjectProvider(options));

    openmct.objects.addRoot({
      namespace: "biosim",
      key: "biosim.root",
    });
  };
}
