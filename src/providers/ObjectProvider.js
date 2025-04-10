import { NAMESPACE_KEY, OBJECT_TYPES, ROOT_KEY } from "../const";
import { encodeKey } from "../utils/keyUtils";

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
        const { simulationInstanceDetails, newSimulationInstanceObject } =
          await this.#buildInstanceObject(simID);
        this.#buildGlobalsObject(simID, newSimulationInstanceObject);
        const unsortedModuleNames = Object.keys(
          simulationInstanceDetails?.modules || {},
        );
        const sortedModuleNames = unsortedModuleNames.sort((a, b) =>
          a.localeCompare(b),
        );
        // iterate through modules of details adding objects
        sortedModuleNames.forEach((moduleName) => {
          const moduleDetails = simulationInstanceDetails?.modules[moduleName];
          this.#buildModuleObject(
            simID,
            newSimulationInstanceObject,
            moduleDetails,
          );
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

  #buildGlobalsObject(simID, parent) {
    const globalsKey = encodeKey(simID, OBJECT_TYPES.GLOBALS, "globals");
    const newGlobalsObject = {
      identifier: {
        key: globalsKey,
        namespace: NAMESPACE_KEY,
      },
      type: OBJECT_TYPES.GLOBALS,
      name: `Globals`,
      composition: [],
    };
    parent.composition.push(newGlobalsObject.identifier);
    this.#addObject(newGlobalsObject);
  }

  async #buildInstanceObject(simID) {
    const simulationInstanceDetails = await this.#fetchJSON(simID);
    const instanceKey = encodeKey(simID, OBJECT_TYPES.SIMULATION, "instance");
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
    this.#rootObject.composition.push(newSimulationInstanceObject.identifier);
    this.#addObject(newSimulationInstanceObject);
    return { newSimulationInstanceObject, simulationInstanceDetails };
  }

  #buildModuleObject(simID, parent, moduleDetails) {
    const moduleKey = encodeKey(
      simID,
      OBJECT_TYPES.ACTIVE_MODULE,
      moduleDetails.moduleName,
    );
    const newModuleObject = {
      identifier: {
        namespace: NAMESPACE_KEY,
        key: moduleKey,
      },
      name: moduleDetails.moduleName,
      type: OBJECT_TYPES.ACTIVE_MODULE,
    };
    parent.composition.push(newModuleObject.identifier);
    this.#addObject(newModuleObject);
  }
}
