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
    // New implementation based on moduleType from simulationInstanceDetails.
    let newModuleObject;
    const moduleType = moduleDetails.moduleType;
    if (moduleType === "SimEnvironment") {
      newModuleObject = this.#buildEnvironment(simID, parent, moduleDetails);
    } else if (moduleType.includes("Sensor")) {
      newModuleObject = this.#buildSensor(simID, parent, moduleDetails);
    } else if (moduleType.includes("Actuator")) {
      newModuleObject = this.#buildActuator(simID, parent, moduleDetails);
    } else if (moduleType.toLowerCase().includes("crew")) {
      newModuleObject = this.#buildCrew(simID, parent, moduleDetails);
    } else if (moduleDetails.consumers || moduleDetails.producers) {
      // Active module construction.
      newModuleObject = this.#buildActiveModule(simID, parent, moduleDetails);
    } else if (moduleType.includes("Store")) {
      newModuleObject = this.#buildStore(simID, parent, moduleDetails);
    } else {
      // Fallback to active module.
      newModuleObject = this.#buildActiveModule(simID, parent, moduleDetails);
    }
    // Add the new module object to the parent's composition.
    if (newModuleObject) {
      parent.composition.push(newModuleObject.identifier);
      this.#addObject(newModuleObject);
    }
  }

  // Skeleton function for building environment modules.
  #buildEnvironment(simID, parent, moduleDetails) {
    const moduleKey = encodeKey(
      simID,
      OBJECT_TYPES.ENVIRONMENT,
      moduleDetails.moduleName,
    );
    const environmentObject = {
      identifier: {
        key: moduleKey,
        namespace: NAMESPACE_KEY,
      },
      name: moduleDetails.moduleName,
      type: OBJECT_TYPES.ENVIRONMENT,
      // Skeleton: Add additional properties as needed.
      composition: [],
    };
    return environmentObject;
  }

  // Skeleton function for building sensor modules.
  #buildSensor(simID, parent, moduleDetails) {
    const moduleKey = encodeKey(
      simID,
      OBJECT_TYPES.SENSOR,
      moduleDetails.moduleName,
    );
    const sensorObject = {
      identifier: {
        key: moduleKey,
        namespace: NAMESPACE_KEY,
      },
      name: moduleDetails.moduleName,
      type: OBJECT_TYPES.SENSOR,
      // Skeleton: Add additional properties as needed.
      composition: [],
    };
    return sensorObject;
  }

  // Skeleton function for building actuator modules.
  #buildActuator(simID, parent, moduleDetails) {
    const moduleKey = encodeKey(
      simID,
      OBJECT_TYPES.ACTUATOR,
      moduleDetails.moduleName,
    );
    const actuatorObject = {
      identifier: {
        key: moduleKey,
        namespace: NAMESPACE_KEY,
      },
      name: moduleDetails.moduleName,
      type: OBJECT_TYPES.ACTUATOR,
      // Skeleton: Add additional properties as needed.
      composition: [],
    };
    return actuatorObject;
  }

  // Skeleton function for building crew modules.
  #buildCrew(simID, parent, moduleDetails) {
    const moduleKey = encodeKey(
      simID,
      OBJECT_TYPES.CREW,
      moduleDetails.moduleName,
    );
    const crewObject = {
      identifier: {
        key: moduleKey,
        namespace: NAMESPACE_KEY,
      },
      name: moduleDetails.moduleName,
      type: OBJECT_TYPES.CREW,
      composition: [],
    };
    // If crew has crew member details (e.g., in properties.crewPeople), add them as children.
    if (moduleDetails.properties && moduleDetails.properties.crewPeople) {
      moduleDetails.properties.crewPeople.forEach((crewMember) => {
        const crewMemberObject = this.#buildCrewMember(
          simID,
          crewObject,
          crewMember,
        );
        crewObject.composition.push(crewMemberObject.identifier);
        this.#addObject(crewMemberObject);
      });
    }
    return crewObject;
  }

  // Skeleton function for building crew member modules.
  #buildCrewMember(simID, parent, crewMemberDetails) {
    // Assuming crewMemberDetails is an object with a name property.
    const memberKey = encodeKey(
      simID,
      OBJECT_TYPES.CREW_MEMBER,
      crewMemberDetails.name,
    );
    const crewMemberObject = {
      identifier: {
        key: memberKey,
        namespace: NAMESPACE_KEY,
      },
      name: crewMemberDetails.name,
      type: OBJECT_TYPES.CREW_MEMBER,
      composition: [],
      // Skeleton: Add additional properties as needed.
    };
    return crewMemberObject;
  }

  // ... existing code ...
  // Skeleton function for building active module (default) objects.
  #buildActiveModule(simID, parent, moduleDetails) {
    const moduleKey = encodeKey(
      simID,
      OBJECT_TYPES.ACTIVE_MODULE,
      moduleDetails.moduleName,
    );
    const activeModuleObject = {
      identifier: {
        key: moduleKey,
        namespace: NAMESPACE_KEY,
      },
      name: moduleDetails.moduleName,
      type: OBJECT_TYPES.ACTIVE_MODULE,
      composition: [],
    };
    // Refactored: use helper methods for building consumers and producers
    this.#buildConsumers(simID, activeModuleObject, moduleDetails.consumers);
    this.#buildProducers(simID, activeModuleObject, moduleDetails.producers);
    return activeModuleObject;
  }

  #buildConsumers(simID, parent, consumers) {
    if (!consumers) {
      return;
    }
    consumers.forEach((consumer) => {
      const consumptionGroupObject = this.#buildConsumptionGroup(
        simID,
        parent,
        consumer,
      );
      consumer.connections.forEach((connection) => {
        if (consumer.rates && consumer.rates.actualFlowRates) {
          this.#buildConsumerTelemetry(
            simID,
            consumptionGroupObject,
            connection,
            "Actual",
          );
        }
        if (consumer.rates && consumer.rates.desiredFlowRates) {
          this.#buildConsumerTelemetry(
            simID,
            consumptionGroupObject,
            connection,
            "Desired",
          );
        }
      });
    });
  }

  #buildConsumptionGroup(simID, parent, consumer) {
    const consumptionKey = encodeKey(
      simID,
      OBJECT_TYPES.CONSUMER,
      `${parent.name}_${consumer.type}_consumption`,
    );
    const consumptionGroup = {
      identifier: {
        key: consumptionKey,
        namespace: NAMESPACE_KEY,
      },
      name: `${consumer.type} Consumption`,
      type: OBJECT_TYPES.CONSUMER,
      composition: [],
    };
    parent.composition.push(consumptionGroup.identifier);
    this.#addObject(consumptionGroup);
    return consumptionGroup;
  }

  #buildProducers(simID, parent, producers) {
    if (!producers) {
      return;
    }
    producers.forEach((producer) => {
      const productionGroupObject = this.#buildProductionGroup(
        simID,
        parent,
        producer,
      );
      producer.connections.forEach((connection) => {
        if (producer.rates && producer.rates.actualFlowRates) {
          this.#buildProducerTelemetry(
            simID,
            productionGroupObject,
            connection,
            "Actual",
          );
        }
        if (producer.rates && producer.rates.desiredFlowRates) {
          this.#buildProducerTelemetry(
            simID,
            productionGroupObject,
            connection,
            "Desired",
          );
        }
      });
    });
  }

  #buildProductionGroup(simID, parent, consumer) {
    const productionKey = encodeKey(
      simID,
      OBJECT_TYPES.PRODUCER,
      `${parent.name}_${consumer.type}_production`,
    );
    const productionGroup = {
      identifier: {
        key: productionKey,
        namespace: NAMESPACE_KEY,
      },
      type: OBJECT_TYPES.PRODUCER,
      name: `${consumer.type} Production`,
      composition: [],
    };
    parent.composition.push(productionGroup.identifier);
    this.#addObject(productionGroup);
    return productionGroup;
  }

  // Skeleton function for building store modules.
  #buildStore(simID, parent, moduleDetails) {
    const moduleKey = encodeKey(
      simID,
      OBJECT_TYPES.STORE,
      moduleDetails.moduleName,
    );
    const storeObject = {
      identifier: {
        key: moduleKey,
        namespace: NAMESPACE_KEY,
      },
      name: moduleDetails.moduleName,
      type: OBJECT_TYPES.STORE,
      composition: [],
      // Skeleton: Add telemetry nodes for currentLevel, currentCapacity, overflow if needed.
    };
    return storeObject;
  }

  // Updated skeleton function for building consumer telemetry objects with connection differentiation.
  #buildConsumerTelemetry(simID, parent, connection, flowCategory) {
    const telemetryKey = encodeKey(
      simID,
      OBJECT_TYPES.CONSUMER_TELEMETRY,
      `${connection}_${flowCategory}`,
    );
    const telemetryObject = {
      identifier: {
        key: telemetryKey,
        namespace: NAMESPACE_KEY,
      },
      name: `${connection} ${flowCategory} Flow Rate`,
      type: OBJECT_TYPES.CONSUMER_TELEMETRY,
      composition: [],
      // Skeleton: Additional properties using flowRates can be added here.
    };
    parent.composition.push(telemetryObject.identifier);
    this.#addObject(telemetryObject);
    return telemetryObject;
  }

  // Updated skeleton function for building producer telemetry objects with connection differentiation.
  #buildProducerTelemetry(simID, parent, connection, flowCategory) {
    const telemetryKey = encodeKey(
      simID,
      OBJECT_TYPES.PRODUCER_TELEMETRY,
      `${connection}_${flowCategory}`,
    );
    const telemetryObject = {
      identifier: {
        key: telemetryKey,
        namespace: NAMESPACE_KEY,
      },
      name: `${connection} ${flowCategory} Flow Rate`,
      type: OBJECT_TYPES.PRODUCER_TELEMETRY,
      composition: [],
      // Skeleton: Additional properties using flowRates can be added here.
    };
    parent.composition.push(telemetryObject.identifier);
    this.#addObject(telemetryObject);
    return telemetryObject;
  }
}
