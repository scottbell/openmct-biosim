// BioSimObjectProvider.js
// This provider is responsible for fetching and returning BioSim objects for Open MCT.
export default class BioSimObjectProvider {
  #baseUrl;
  #simDataPromises;
  constructor(options = {}) {
    // Set default base URL for BioSim API endpoints.
    this.#baseUrl = options.baseUrl || "http://localhost:8009";
    // Cache simulation data promises by simId so subsequent gets wait on the first GET.
    this.#simDataPromises = {};
  }

  // Utility function for fetching JSON data with error handling.
  async #fetchJSON(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Error fetching ${url}: ${response.statusText}`);
    }
    return response.json();
  }

  // Loads and caches simulation data by simId.
  #loadSimData(simId) {
    if (!this.#simDataPromises[simId]) {
      this.#simDataPromises[simId] = this.#fetchJSON(
        `${this.#baseUrl}/api/simulation/${simId}`,
      );
    }
    return this.#simDataPromises[simId];
  }

  #encodeKey(simId, type, name) {
    // check if any missing and throw an error
    if (!simId || !type || !name) {
      throw new Error(
        `🛑 Missing parameters for encoding key for simID: ${simId}, type: ${type}, name: ${name}`,
      );
    }
    return `${simId}:${type}:${name}`;
  }

  #decodeKey(key) {
    const splitEntries = key.split(":");
    // check if we have 3 entries
    if (splitEntries.length !== 3) {
      throw new Error(
        `🛑 Invalid keyformat. Require 3 entries separated by a colon: ${key}`,
      );
    }
    return {
      simId: splitEntries[0],
      type: splitEntries[1],
      name: splitEntries[2],
    };
  }

  // Loop through each module in the simDetails to create a module reference.
  #extractModules(simDetails, simId) {
    // updated to accept simId as second parameter
    const modules = [];
    if (simDetails.modules) {
      // check if modules is present
      if (simDetails.modules) {
        // check if modules is present
        Object.keys(simDetails.modules).forEach((moduleName) => {
          modules.push({
            identifier: {
              key: this.#encodeKey(simId, "biosim.module", moduleName),
              namespace: "biosim",
            },
          });
        });
      }
    }
    return modules;
  }

  async get(identifier) {
    console.debug(
      `📦 foo Fetching object for identifier: ${JSON.stringify(identifier)}`,
    );
    // Root object: list all simulation IDs.
    if (identifier.key === "biosim.root") {
      const allSimulations = await this.#fetchJSON(
        `${this.#baseUrl}/api/simulation`,
      );
      const composition = allSimulations.simulations.map((simId) => ({
        identifier: {
          key: this.#encodeKey(simId, "biosim.sim", "Instance"),
          namespace: "biosim",
        },
      }));
      return {
        identifier,
        name: "BioSim Simulations",
        type: "biosim.root",
        location: "ROOT",
        composition,
      };
    }

    const { simId, type, name } = this.#decodeKey(identifier);

    // A simulation instance: get detailed configuration.
    if (type === "biosim.sim") {
      return {
        identifier,
        name: `Instance ${simId}`,
        type: "biosim.sim",
        location: "biosim.root",
        composition: [
          {
            identifier: {
              key: this.#encodeKey(simId, "biosim.sim.modules", `Instance`),
              namespace: "biosim",
            },
          },
          {
            identifier: {
              key: this.#encodeKey(simId, "biosim.sim.globals", `Globals`),
              namespace: "biosim",
            },
          },
        ],
      };
    }

    // SimModules category: list all module keys from the 'modules' section.
    if (type === "biosim.sim.modules") {
      const simDetails = await this.#loadSimData(simId);
      const modules = this.#extractModules(simDetails, simId);
      return {
        identifier,
        name: "SimModules",
        type: "biosim.sim.modules",
        composition: modules,
      };
    }

    // Globals category: directly return the globals.
    if (type === "biosim.sim.globals") {
      const simDetails = await this.#loadSimData(simId);
      return {
        identifier,
        name: "Globals",
        type: "biosim.sim.globals",
        detail: simDetails.globals,
      };
    }

    // Individual module details.
    if (type === "biosim.module") {
      // Use our decoder function to extract simId and moduleName.
      const simDetails = await this.#loadSimData(simId);
      return {
        identifier,
        name,
        type: "biosim.module",
        simDetails: simDetails.modules[name],
      };
    }

    return {};
  }
}
