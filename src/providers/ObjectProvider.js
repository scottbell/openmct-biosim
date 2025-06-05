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
    // sort simIDs
    simIDs.sort((a, b) => a - b);
    // for each simID, we need to make requests about the modules and globals.
    await Promise.all(
      simIDs.map(async (simID) => {
        const { simulationInstanceDetails, newSimulationInstanceObject } =
          await this.#buildInstanceObject(simID, this.#rootObject);
        this.#buildGlobalsObject(newSimulationInstanceObject);
        const unsortedModuleNames = Object.keys(
          simulationInstanceDetails?.modules || {},
        );
        const sortedModuleNames = unsortedModuleNames.sort((a, b) =>
          a.localeCompare(b),
        );
        // iterate through modules of details adding objects
        sortedModuleNames.forEach((moduleName) => {
          const moduleDetails = simulationInstanceDetails?.modules[moduleName];
          this.#buildModuleObject(newSimulationInstanceObject, moduleDetails);
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

  #buildGlobalsObject(parent) {
    const globalsKey = encodeKey(parent, "globals");
    const newGlobalsObject = {
      identifier: {
        key: globalsKey,
        namespace: NAMESPACE_KEY,
      },
      simID: parent.simID,
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
      const telemetryKey = encodeKey(parent, field);
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
        simID: newGlobalsObject.simID,
        field,
        configuration: {},
        telemetry: this.#getInitializedTelemetry(),
      };
      newGlobalsObject.composition.push(telemetryObject.identifier);
      this.#addObject(telemetryObject);
    });
  }

  #getInitializedTelemetry() {
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
          key: "value",
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
    const instanceKey = encodeKey(parent, `instance_${simID}`);
    const newSimulationInstanceObject = {
      identifier: {
        key: instanceKey,
        namespace: NAMESPACE_KEY,
      },
      type: OBJECT_TYPES.SIMULATION,
      name: `Simulation ${simID}`,
      location: this.#openmct.objects.makeKeyString(parent.identifier),
      globals: simulationInstanceDetails?.globals,
      simID,
      instance: simID,
      composition: [],
    };
    this.#rootObject.composition.push(newSimulationInstanceObject.identifier);
    this.#addObject(newSimulationInstanceObject);
    return { newSimulationInstanceObject, simulationInstanceDetails };
  }

  #buildModuleObject(parent, moduleDetails) {
    // New implementation based on moduleType from simulationInstanceDetails.
    let newModuleObject;
    const moduleType = moduleDetails.moduleType;
    if (moduleType === "SimEnvironment") {
      newModuleObject = this.#buildEnvironment(parent, moduleDetails);
    } else if (moduleType.includes("Sensor")) {
      newModuleObject = this.#buildSensor(parent, moduleDetails);
    } else if (moduleType.includes("Actuator")) {
      newModuleObject = this.#buildActuator(parent, moduleDetails);
    } else if (moduleType.toLowerCase().includes("crew")) {
      newModuleObject = this.#buildCrew(parent, moduleDetails);
    } else if (moduleType.toLowerCase().includes("biomassps")) {
      newModuleObject = this.#buildBiomassPS(parent, moduleDetails);
    } else if (moduleDetails.consumers || moduleDetails.producers) {
      newModuleObject = this.#buildActiveModule(parent, moduleDetails);
    } else if (moduleType.includes("Store")) {
      newModuleObject = this.#buildStore(parent, moduleDetails);
    }
    parent.composition.push(newModuleObject.identifier);
    this.#addObject(newModuleObject);
  }

  // Skeleton function for building environment modules.
  #buildEnvironment(parent, moduleDetails) {
    const moduleKey = encodeKey(parent, moduleDetails.moduleName);
    const environmentObject = {
      identifier: {
        key: moduleKey,
        namespace: NAMESPACE_KEY,
      },
      name: moduleDetails.moduleName,
      type: OBJECT_TYPES.ENVIRONMENT,
      location: this.#openmct.objects.makeKeyString(parent.identifier),
      simID: parent.simID,
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
      const telemetryKey = encodeKey(environmentObject, field);
      const telemetryObject = {
        identifier: {
          key: telemetryKey,
          namespace: NAMESPACE_KEY,
        },
        name: field,
        field: field,
        moduleName: moduleDetails.moduleName,
        type: OBJECT_TYPES.ENVIRONMENT_TELEMETRY,
        location: this.#openmct.objects.makeKeyString(
          environmentObject.identifier,
        ),
        simID: environmentObject.simID,
        configuration: {},
        telemetry: this.#getInitializedTelemetry(),
      };
      environmentObject.composition.push(telemetryObject.identifier);
      this.#addObject(telemetryObject);
    });
    return environmentObject;
  }

  #convertAlarmThresholdsToLimits(alarmThresholds, range, valueKey) {
    const limitColors = {
      WATCH_LOW: "cyan",
      WATCH_HIGH: "cyan",
      WARNING_LOW: "yellow",
      WARNING_HIGH: "yellow",
      DISTRESS_LOW: "orange",
      DISTRESS_HIGH: "orange",
      CRITICAL_LOW: "red",
      CRITICAL_HIGH: "red",
      SEVERE_LOW: "purple",
      SEVERE_HIGH: "purple",
    };

    const limits = {};
    // Group thresholds by severity so CSS width classes apply to full lines
    Object.keys(limitColors)
      .map((key) => key.split("_")[0])
      .filter((v, i, a) => a.indexOf(v) === i)
      .forEach((level) => {
        const color =
          limitColors[`${level}_LOW`] || limitColors[`${level}_HIGH`];
        const lowKey = `${level}_LOW`;
        const highKey = `${level}_HIGH`;
        if (alarmThresholds[lowKey]) {
          limits[level] = limits[level] || {};
          limits[level].low = { color };
          limits[level].low[valueKey] = alarmThresholds[lowKey].min;
        }
        if (alarmThresholds[highKey]) {
          limits[level] = limits[level] || {};
          limits[level].high = { color };
          limits[level].high[valueKey] = alarmThresholds[highKey].max;
        }
      });

    return limits;
  }

  // Modify sensor creation to use alarmThresholds if available
  #buildSensor(parent, moduleDetails) {
    const moduleKey = encodeKey(parent, moduleDetails.moduleName);
    const properties = moduleDetails.properties;
    let limits;
    if (properties.alarmThresholds) {
      limits = this.#convertAlarmThresholdsToLimits(
        properties.alarmThresholds,
        properties.range,
        "value",
      );
    }
    const sensorObject = {
      identifier: {
        key: moduleKey,
        namespace: NAMESPACE_KEY,
      },
      name: moduleDetails.moduleName,
      type: OBJECT_TYPES.SENSOR,
      simID: parent.simID,
      moduleName: moduleDetails.moduleName,
      field: "value",
      limits,
      range: properties.range,
      location: this.#openmct.objects.makeKeyString(parent.identifier),
      telemetry: this.#getInitializedTelemetry(),
    };
    return sensorObject;
  }

  // Skeleton function for building actuator modules.
  #buildActuator(parent, moduleDetails) {
    const moduleKey = encodeKey(parent, moduleDetails.moduleName);
    const actuatorObject = {
      identifier: {
        key: moduleKey,
        namespace: NAMESPACE_KEY,
      },
      name: moduleDetails.moduleName,
      moduleName: moduleDetails.moduleName,
      simID: parent.simID,
      type: OBJECT_TYPES.ACTUATOR,
      location: this.#openmct.objects.makeKeyString(parent.identifier),
    };
    return actuatorObject;
  }

  #buildBiomassPS(parent, moduleDetails) {
    const moduleKey = encodeKey(parent, moduleDetails.moduleName);
    const biomassObject = {
      identifier: {
        key: moduleKey,
        namespace: NAMESPACE_KEY,
      },
      name: moduleDetails.moduleName,
      simID: parent.simID,
      type: OBJECT_TYPES.BIOMASSPS,
      location: this.#openmct.objects.makeKeyString(parent.identifier),
      composition: [],
    };

    // If there are shelves defined in properties, build a shelf object for each
    if (moduleDetails?.properties?.shelves) {
      let index = 0;
      moduleDetails.properties.shelves.forEach((shelf) => {
        const shelfObject = this.#buildBiomassPSShelf(
          biomassObject,
          shelf,
          index,
        );
        biomassObject.composition.push(shelfObject.identifier);
        this.#addObject(shelfObject);
        index++;
      });
    }
    this.#buildFlowrateControllable({
      parent: biomassObject,
      flows: moduleDetails.consumers,
      telemetryType: OBJECT_TYPES.CONSUMER_TELEMETRY,
    });
    this.#buildFlowrateControllable({
      parent: biomassObject,
      flows: moduleDetails.producers,
      telemetryType: OBJECT_TYPES.PRODUCER_TELEMETRY,
    });
    return biomassObject;
  }

  #buildBiomassPSShelf(parent, shelfDetails, index) {
    const shelfKey = encodeKey(parent, `shelf_${index}`);
    const shelfObject = {
      identifier: {
        key: shelfKey,
        namespace: NAMESPACE_KEY,
      },
      name: `Shelf ${index + 1}: ${shelfDetails.plantType}`,
      simID: parent.simID,
      type: OBJECT_TYPES.BIOMSSPS_SHELF,
      location: this.#openmct.objects.makeKeyString(parent.identifier),
      composition: [],
    };

    const telemetryFields = [
      "cropAreaUsed",
      "cropAreaTotal",
      "timeTillCanopyClosure",
      "harvestInterval",
      "ppfNeeded",
      "molesOfCO2Inhaled",
    ];

    // Create telemetry objects for each field
    telemetryFields.forEach((field) => {
      const telemetryKey = encodeKey(shelfObject, field);
      const telemetryObject = {
        identifier: {
          key: telemetryKey,
          namespace: NAMESPACE_KEY,
        },
        name: field,
        simID: shelfObject.simID,
        field: field,
        type: OBJECT_TYPES.BIOMSSPS_SHELF_TELEMETRY,
        location: this.#openmct.objects.makeKeyString(shelfObject.identifier),
        configuration: {},
        telemetry: this.#getInitializedTelemetry(),
        moduleName: parent.name,
        shelfIndex: index,
      };
      shelfObject.composition.push(telemetryObject.identifier);
      this.#addObject(telemetryObject);
    });

    return shelfObject;
  }

  #buildCrew(parent, moduleDetails) {
    const moduleKey = encodeKey(parent, moduleDetails.moduleName);
    const crewObject = {
      identifier: {
        key: moduleKey,
        namespace: NAMESPACE_KEY,
      },
      name: moduleDetails.moduleName,
      type: OBJECT_TYPES.CREW,
      simID: parent.simID,
      location: this.#openmct.objects.makeKeyString(parent.identifier),
      composition: [],
    };
    moduleDetails?.properties?.crewPeople?.forEach((crewMember) => {
      const crewMemberObject = this.#buildCrewMember(crewObject, crewMember);
      crewObject.composition.push(crewMemberObject.identifier);
      this.#addObject(crewMemberObject);
    });
    this.#buildFlowrateControllable({
      parent: crewObject,
      flows: moduleDetails.consumers,
      telemetryType: OBJECT_TYPES.CONSUMER_TELEMETRY,
    });
    this.#buildFlowrateControllable({
      parent: crewObject,
      flows: moduleDetails.producers,
      telemetryType: OBJECT_TYPES.PRODUCER_TELEMETRY,
    });
    return crewObject;
  }

  #buildCrewMember(parent, crewMemberDetails) {
    // replace spaces in name with underscores
    const crewMemberKey = crewMemberDetails.name.replace(/\s+/g, "_");
    const memberKey = encodeKey(parent, crewMemberKey);
    const crewMemberObject = {
      identifier: {
        key: memberKey,
        namespace: NAMESPACE_KEY,
      },
      simID: parent.simID,
      name: crewMemberDetails.name,
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
      const telemetryKey = encodeKey(crewMemberObject, field);
      const telemetryObject = {
        identifier: {
          key: telemetryKey,
          namespace: NAMESPACE_KEY,
        },
        name: field,
        type: OBJECT_TYPES.CREW_MEMBER_TELEMETRY,
        simID: crewMemberObject.simID,
        location: this.#openmct.objects.makeKeyString(
          crewMemberObject.identifier,
        ),
        crewMemberName: crewMemberObject.name,
        moduleName: parent.name,
        field,
        configuration: {},
        telemetry: this.#getInitializedTelemetry(),
      };
      crewMemberObject.composition.push(telemetryObject.identifier);
      this.#addObject(telemetryObject);
    });
    return crewMemberObject;
  }

  #buildActiveModule(parent, moduleDetails) {
    const moduleKey = encodeKey(parent, moduleDetails.moduleName);
    const activeModuleObject = {
      identifier: {
        key: moduleKey,
        namespace: NAMESPACE_KEY,
      },
      name: moduleDetails.moduleName,
      type: OBJECT_TYPES.ACTIVE_MODULE,
      simID: parent.simID,
      location: this.#openmct.objects.makeKeyString(parent.identifier),
      composition: [],
    };
    this.#buildFlowrateControllable({
      parent: activeModuleObject,
      flows: moduleDetails.consumers,
      telemetryType: OBJECT_TYPES.CONSUMER_TELEMETRY,
    });
    this.#buildFlowrateControllable({
      parent: activeModuleObject,
      flows: moduleDetails.producers,
      telemetryType: OBJECT_TYPES.PRODUCER_TELEMETRY,
    });
    return activeModuleObject;
  }

  #buildFlowGroup({ parent, flowType, telemetryType }) {
    // Determine the group type based on the consumer type.
    const groupType =
      telemetryType === OBJECT_TYPES.CONSUMER_TELEMETRY
        ? OBJECT_TYPES.CONSUMER
        : OBJECT_TYPES.PRODUCER;

    // Use the group type to determine the group label.
    const groupLabel =
      groupType === OBJECT_TYPES.CONSUMER ? "Consumers" : "Producers";

    const groupKey = encodeKey(parent, `${flowType}_${groupLabel}`);
    const groupObject = {
      identifier: {
        key: groupKey,
        namespace: NAMESPACE_KEY,
      },
      name: `${flowType} ${groupLabel}`,
      type: groupType,
      simID: parent.simID,
      flowType,
      location: this.#openmct.objects.makeKeyString(parent.identifier),
      composition: [],
    };
    parent.composition.push(groupObject.identifier);
    this.#addObject(groupObject);
    return groupObject;
  }

  #buildFlowrateControllable({ parent, flows, telemetryType }) {
    if (!flows) {
      return;
    }
    flows.forEach((flow) => {
      const flowGroup = this.#buildFlowGroup({
        parent,
        flowType: flow.type,
        telemetryType,
      });
      flow.connections.forEach((connection) => {
        if (flow?.rates?.actualFlowRates) {
          this.#buildFlowrateTelemetry({
            parent: flowGroup,
            moduleName: parent.name,
            connection,
            flowType: "Actual",
            telemetryType,
          });
        }
        if (flow?.rates?.desiredFlowRates) {
          this.#buildFlowrateTelemetry({
            parent: flowGroup,
            moduleName: parent.name,
            connection,
            flowType: "Desired",
            telemetryType,
          });
        }
      });
    });
  }

  #buildFlowrateTelemetry({
    parent,
    connection,
    moduleName,
    flowType,
    telemetryType,
  }) {
    const telemetryKey = encodeKey(parent, `${connection}_${flowType}`);
    const telemetryObject = {
      identifier: {
        key: telemetryKey,
        namespace: NAMESPACE_KEY,
      },
      name: `${connection} ${flowType} Flow Rate`,
      type: telemetryType,
      moduleName,
      connection,
      flowType,
      simID: parent.simID,
      location: this.#openmct.objects.makeKeyString(parent.identifier),
      telemetry: this.#getInitializedTelemetry(),
    };
    parent.composition.push(telemetryObject.identifier);
    this.#addObject(telemetryObject);
    return telemetryObject;
  }

  #buildStore(parent, moduleDetails) {
    const moduleKey = encodeKey(parent, moduleDetails.moduleName);
    const storeObject = {
      identifier: {
        key: moduleKey,
        namespace: NAMESPACE_KEY,
      },
      simID: parent.simID,
      name: moduleDetails.moduleName,
      type: OBJECT_TYPES.STORE,
      location: this.#openmct.objects.makeKeyString(parent.identifier),
      composition: [],
    };
    const telemetryFields = ["currentLevel", "currentCapacity", "overflow"];
    telemetryFields.forEach((field) => {
      const telemetryKey = encodeKey(storeObject, field);
      const telemetryObject = {
        identifier: {
          key: telemetryKey,
          namespace: NAMESPACE_KEY,
        },
        name: field,
        field: field,
        moduleName: moduleDetails.moduleName,
        simID: storeObject.simID,
        type: OBJECT_TYPES.STORE_TELEMETRY,
        location: this.#openmct.objects.makeKeyString(storeObject.identifier),
        configuration: {},
        telemetry: this.#getInitializedTelemetry(),
      };
      storeObject.composition.push(telemetryObject.identifier);
      this.#addObject(telemetryObject);
    });
    return storeObject;
  }
}
