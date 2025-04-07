import { NAMESPACE_KEY, OBJECT_TYPES, ROOT_KEY } from "./const";

// BioSimObjectProvider.js
// This provider is responsible for fetching and returning BioSim objects for Open MCT.
export default class BioSimObjectProvider {
  #baseUrl;
  #rootObject;
  constructor(options = {}) {
    // Set default base URL for BioSim API endpoints.
    this.#baseUrl = options.baseUrl || "http://localhost:8009";
    this.dictionary = {};
    this.#rootObject = this.#createRootObject();
  }

  // Utility function for fetching JSON data with error handling.
  async #fetchJSON(urlSuffix) {
    const url = `${this.#baseUrl}/api/simulation/${urlSuffix}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Error fetching ${url}: ${response.statusText}`);
    }
    return response.json();
  }

  #encodeKey(simId, type, name) {
    // Check if any parameters are missing and throw an error if so.
    if (!simId || !type || !name) {
      throw new Error(
        `🛑 Missing parameters for encoding key for simID: ${simId}, type:${type}, name: ${name}`,
      );
    }
    return `${simId}:${type}:${name}`;
  }

  async get(identifier) {
    const { key } = identifier;
    await this.#loadBiosimDictionary();
    const object = this.dictionary[key];

    return object;
  }

  #createRootObject() {
    const rootObject = {
      identifier: {
        key: ROOT_KEY,
        namespace: NAMESPACE_KEY,
      },
      name: "BioSim Simulations",
      type: "folder",
      location: "ROOT",
      composition: [],
    };
    this.#addObject(rootObject);

    return rootObject;
  }

  async #fetchFromBiosim() {
    const biosimStatus = await this.#fetchJSON("");
    const simIDs = biosimStatus?.simulations;
    // for each simID, we need to make requests about the modules and globals.
    await Promise.all(
      simIDs.map(async (simID) => {
        const simulationInstanceDetails = await this.#fetchJSON(simID);
        // make the sim instance
        const instanceKey = this.#encodeKey(
          simID,
          OBJECT_TYPES.SIMULATION,
          "instance",
        );
        const newSimulationInstanceObject = {
          identifier: {
            key: instanceKey,
            namespace: NAMESPACE_KEY,
          },
          type: OBJECT_TYPES.SIMULATION,
          name: `Simulation ${simID}`,
          globals: simulationInstanceDetails?.globals,
          composition: [],
        };
        this.#rootObject.composition.push(
          newSimulationInstanceObject.identifier,
        );
        this.#addObject(newSimulationInstanceObject);

        const modulesKey = this.#encodeKey(
          simID,
          OBJECT_TYPES.SIM_MODULES,
          "modules",
        );
        const newModulesObject = {
          identifier: {
            key: modulesKey,
            namespace: NAMESPACE_KEY,
          },
          type: OBJECT_TYPES.SIM_MODULES,
          name: `Modules`,
          composition: [],
        };
        newSimulationInstanceObject.composition.push(
          newModulesObject.identifier,
        );
        this.#addObject(newModulesObject);

        const moduleNames = Object.keys(
          simulationInstanceDetails?.modules || {},
        );

        // iterate through modules of details adding objects
        moduleNames.forEach((moduleName) => {
          const module = simulationInstanceDetails.modules[moduleName];
          const moduleKey = this.#encodeKey(
            simID,
            OBJECT_TYPES.SIM_MODULE,
            module.moduleName,
          );
          const newModuleObject = {
            identifier: {
              key: moduleKey,
              namespace: NAMESPACE_KEY,
            },
            type: OBJECT_TYPES.SIM_MODULE,
            name: module.moduleName,
          };
          newModulesObject.composition.push(newModuleObject.identifier);
          this.#addObject(newModuleObject);
        });
      }),
    );
  }

  #addObject(object) {
    this.dictionary[object.identifier.key] = object;
  }

  #loadBiosimDictionary() {
    if (!this.fetchBiosimPromise) {
      this.fetchBiosimPromise = this.#fetchFromBiosim();
    }

    return this.fetchBiosimPromise;
  }

  supportsSearchType(type) {
    return false;
  }
}
