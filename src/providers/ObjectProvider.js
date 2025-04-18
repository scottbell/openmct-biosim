import { NAMESPACE_KEY, OBJECT_TYPES, ROOT_KEY } from "../const";
import { encodeKey } from "../utils/keyUtils";

// BioSimObjectProvider.js
// This provider is responsible for fetching and returning BioSim objects for Open MCT.
export default class BioSimObjectProvider {
  #baseUrl;
  #rootObject;
  #openmct;
  constructor(openmct, options = {}) {
    // Set default base URL for BioSim API endpoints.
    this.#baseUrl = options.baseUrl || "http://localhost:8009";
    this.dictionary = {};
    this.#rootObject = this.#createRootObject();
    this.#openmct = openmct;
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
    if (!object) {
      console.error(`🛑 Object with key ${key} not found`);
    }
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
          await this.#buildInstanceObject(simID, this.#rootObject);
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
      composition: [],
      type: OBJECT_TYPES.GLOBALS,
      name: `Globals`,
    };
    parent.composition.push(newGlobalsObject.identifier);
    this.#addObject(newGlobalsObject);

    const globalFields = [
      "ticksGoneBy",
      "myID",
      "tickLength",
      "runTillN",
      "driverStutterLength",
    ];
    globalFields.forEach((field) => {
      const name = `${newGlobalsObject.name}.${field}`;
      const telemetryKey = encodeKey(
        simID,
        OBJECT_TYPES.GLOBALS_METADATUM,
        name,
      );
      const telemetryObject = {
        identifier: {
          key: telemetryKey,
          namespace: NAMESPACE_KEY,
        },
        name: field,
        type: OBJECT_TYPES.GLOBALS_METADATUM,
        location: this.#openmct.objects.makeKeyString(
          newGlobalsObject.identifier,
        ),
        configuration: {},
        telemetry: this.#getInitializedTelemetry(name),
      };
      newGlobalsObject.composition.push(telemetryObject.identifier);
      this.#addObject(telemetryObject);
    });
  }

  #getInitializedTelemetry(name) {
    return {
      values: [
        {
          key: "utc",
          source: "timestamp",
          name: "Timestamp",
          format: "iso",
          hints: {
            domain: 1,
          },
        },
        {
          key: name,
          name: "Value",
          format: "float",
          source: "value",
          hints: {
            range: 1,
          },
        },
      ],
    };
  }

  async #buildInstanceObject(simID, parent) {
    const simulationInstanceDetails = await this.#fetchJSON(simID);
    const instanceKey = encodeKey(simID, OBJECT_TYPES.SIMULATION, "instance");
    const newSimulationInstanceObject = {
      identifier: {
        key: instanceKey,
        namespace: NAMESPACE_KEY,
      },
      type: OBJECT_TYPES.SIMULATION,
      name: `Simulation ${simID}`,
      location: this.#openmct.objects.makeKeyString(parent.identifier),
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
    parent.composition.push(newModuleObject.identifier);
    this.#addObject(newModuleObject);
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
      location: this.#openmct.objects.makeKeyString(parent.identifier),
      // Skeleton: Add additional properties as needed.
      composition: [],
    };

    const telemetryFields = [
      "temperature",
      "temperatureInKelvin",
      "lightIntensity",
      "currentVolume",
      "initialVolume",
      "dayLength",
      "hourOfDayStart",
      "maxLumens",
      "relativeHumidity",
      "airLockVolume",
      "totalPressure",
      "totalMoles",
      "dangerousOxygenThreshold",
      "leakRate",
      "initialTotalPressure",
      "o2Moles",
      "co2Moles",
      "otherMoles",
      "vaporMoles",
      "nitrogenMoles",
    ];
    telemetryFields.forEach((field) => {
      const name = `${moduleDetails.moduleName}.${field}`;
      const telemetryKey = encodeKey(
        simID,
        OBJECT_TYPES.ENVIRONMENT_TELEMETRY,
        name,
      );
      const telemetryObject = {
        identifier: {
          key: telemetryKey,
          namespace: NAMESPACE_KEY,
        },
        name: field,
        type: OBJECT_TYPES.ENVIRONMENT_TELEMETRY,
        location: this.#openmct.objects.makeKeyString(
          environmentObject.identifier,
        ),
        configuration: {},
        telemetry: this.#getInitializedTelemetry(name),
      };
      environmentObject.composition.push(telemetryObject.identifier);
      this.#addObject(telemetryObject);
    });
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
      location: this.#openmct.objects.makeKeyString(parent.identifier),
      telemetry: this.#getInitializedTelemetry(moduleDetails.moduleName),
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
      location: this.#openmct.objects.makeKeyString(parent.identifier),
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
      location: this.#openmct.objects.makeKeyString(parent.identifier),
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

  #buildCrewMember(simID, parent, crewMemberDetails) {
    // replace spaces in name with underscores
    const crewMemberName = crewMemberDetails.name.replace(/\s+/g, "_");
    const memberKey = encodeKey(
      simID,
      OBJECT_TYPES.CREW_MEMBER,
      crewMemberName,
    );
    const crewMemberObject = {
      identifier: {
        key: memberKey,
        namespace: NAMESPACE_KEY,
      },
      name: crewMemberName,
      type: OBJECT_TYPES.CREW_MEMBER,
      location: this.#openmct.objects.makeKeyString(parent.identifier),
      composition: [],
    };
    const telemetryFields = [
      "age",
      "weight",
      "timeActivityPerformed",
      "currentActivityIntensity",
      "currentActivityTimeLength",
      "O2Consumed",
      "CO2Produced",
      "caloriesConsumed",
      "potableWaterConsumed",
      "dirtyWaterProduced",
      "greyWaterProduced",
    ];
    telemetryFields.forEach((field) => {
      const name = `${parent.name}.${crewMemberName}.${field}`;
      const telemetryKey = encodeKey(
        simID,
        OBJECT_TYPES.CREW_MEMBER_TELEMETRY,
        name,
      );
      const telemetryObject = {
        identifier: {
          key: telemetryKey,
          namespace: NAMESPACE_KEY,
        },
        name: field,
        type: OBJECT_TYPES.CREW_MEMBER_TELEMETRY,
        location: this.#openmct.objects.makeKeyString(
          crewMemberObject.identifier,
        ),
        configuration: {},
        telemetry: this.#getInitializedTelemetry(name),
      };
      crewMemberObject.composition.push(telemetryObject.identifier);
      this.#addObject(telemetryObject);
    });
    return crewMemberObject;
  }

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
      location: this.#openmct.objects.makeKeyString(parent.identifier),
      composition: [],
    };
    this.#buildFlowrateControllable({
      simID,
      parent: activeModuleObject,
      flows: moduleDetails.consumers,
      telemetryType: OBJECT_TYPES.CONSUMER_TELEMETRY,
    });
    this.#buildFlowrateControllable({
      simID,
      parent: activeModuleObject,
      flows: moduleDetails.producers,
      telemetryType: OBJECT_TYPES.PRODUCER_TELEMETRY,
    });
    return activeModuleObject;
  }

  #buildFlowGroup({ simID, parent, flowType, telemetryType }) {
    // Determine the group type based on the consumer type.
    const groupType =
      telemetryType === OBJECT_TYPES.CONSUMER_TELEMETRY
        ? OBJECT_TYPES.CONSUMER
        : OBJECT_TYPES.PRODUCER;

    // Use the group type to determine the group label.
    const groupLabel =
      groupType === OBJECT_TYPES.CONSUMER ? "Consumers" : "Producers";

    const groupKey = encodeKey(
      simID,
      groupType,
      `${parent.name}_${flowType}_${groupLabel.toLowerCase()}`,
    );
    const groupObject = {
      identifier: {
        key: groupKey,
        namespace: NAMESPACE_KEY,
      },
      name: `${flowType} ${groupLabel}`,
      type: groupType,
      location: this.#openmct.objects.makeKeyString(parent.identifier),
      composition: [],
    };
    parent.composition.push(groupObject.identifier);
    this.#addObject(groupObject);
    return groupObject;
  }

  #buildFlowrateControllable({ simID, parent, flows, telemetryType }) {
    if (!flows) {
      return;
    }
    flows.forEach((flow) => {
      const flowGroup = this.#buildFlowGroup({
        simID,
        parent,
        flowType: flow.type,
        telemetryType,
      });
      flow.connections.forEach((connection) => {
        if (flow.rates && flow.rates.actualFlowRates) {
          this.#buildFlowrateTelemetry({
            simID,
            parent: flowGroup,
            moduleName: parent.name,
            connection,
            flowCategory: "Actual",
            telemetryType,
          });
        }
        if (flow.rates && flow.rates.desiredFlowRates) {
          this.#buildFlowrateTelemetry({
            simID,
            parent: flowGroup,
            moduleName: parent.name,
            connection,
            flowCategory: "Desired",
            telemetryType,
          });
        }
      });
    });
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
      location: this.#openmct.objects.makeKeyString(parent.identifier),
      composition: [],
    };
    const telemetryFields = ["currentLevel", "currentCapacity", "overflow"];
    telemetryFields.forEach((field) => {
      const name = `${moduleDetails.moduleName}.${field}`;
      const telemetryKey = encodeKey(simID, OBJECT_TYPES.STORE_TELEMETRY, name);
      const telemetryObject = {
        identifier: {
          key: telemetryKey,
          namespace: NAMESPACE_KEY,
        },
        name: field,
        type: OBJECT_TYPES.STORE_TELEMETRY,
        location: this.#openmct.objects.makeKeyString(storeObject.identifier),
        configuration: {},
        telemetry: this.#getInitializedTelemetry(name),
      };
      storeObject.composition.push(telemetryObject.identifier);
      this.#addObject(telemetryObject);
    });
    return storeObject;
  }

  #buildFlowrateTelemetry({
    simID,
    parent,
    connection,
    moduleName,
    flowCategory,
    telemetryType,
  }) {
    const name = `${moduleName}.${connection}.${flowCategory}`;
    const telemetryKey = encodeKey(simID, telemetryType, name);
    const telemetryObject = {
      identifier: {
        key: telemetryKey,
        namespace: NAMESPACE_KEY,
      },
      name: `${connection} ${flowCategory} Flow Rate`,
      type: telemetryType,
      location: this.#openmct.objects.makeKeyString(parent.identifier),
      telemetry: this.#getInitializedTelemetry(name),
    };
    parent.composition.push(telemetryObject.identifier);
    this.#addObject(telemetryObject);
    return telemetryObject;
  }
}
