import { LRUCache } from "lru-cache";

import { OBJECT_TYPES } from "../const";
import { decodeKey } from "../utils/keyUtils";

export default class RealtimeTelemetryProvider {
  constructor({
    telemetryDataToKeepPerModule,
    unsubscribeFromModulesOnStop,
    baseURL,
    pollingInterval,
  }) {
    this.subscriptionsByID = {};
    this.telemetryDataToKeepPerTopic = telemetryDataToKeepPerModule || 1000;
    this.unsubscribeFromModulesOnStop = unsubscribeFromModulesOnStop;
    this.baseURL = baseURL || "http://localhost:8009";
    this.pollingInterval = pollingInterval || 1000; // Default to 1 second
    // Map to store WebSocket connections by simulation ID
    this.websocketsBySimID = {};
    // Map to store LRU caches by simulation ID
    this.simulationCaches = {};
  }

  /**
   * Gets or creates an LRU cache for a specific simulation ID
   * @param {number} simID - The simulation ID
   * @returns {LRUCache} The LRU cache for the simulation
   */
  #getOrCreateSimCache(simID) {
    if (!this.simulationCaches[simID]) {
      this.simulationCaches[simID] = new LRUCache({
        max: this.telemetryDataToKeepPerTopic,
      });
    }
    return this.simulationCaches[simID];
  }

  /**
   * Creates telemetry details from a domain object or subscriber ID
   * @param {Object|string} domainObjectOrID - The domain object or subscriber ID
   * @returns {Object} The telemetry details
   */
  #createTelemetryDetails(domainObjectOrID) {
    const subscriberID =
      typeof domainObjectOrID === "string"
        ? domainObjectOrID
        : domainObjectOrID.identifier.key;

    const { simID, name, type } = decodeKey(subscriberID);
    const details = {};
    if (
      type === OBJECT_TYPES.PRODUCER_TELEMETRY ||
      type === OBJECT_TYPES.CONSUMER_TELEMETRY
    ) {
      const parts = name.split(".");
      details.moduleName = parts[0];
      details.connection = parts[1];
      details.flowType = parts[2];
      // either "producers" or "consumers" depending on the type
      details.flowDirection =
        type === OBJECT_TYPES.PRODUCER_TELEMETRY ? "producers" : "consumers";
    } else if (type === OBJECT_TYPES.STORE_TELEMETRY) {
      const parts = name.split(".");
      details.moduleName = parts[0];
      details.field = parts[1];
    } else if (type === OBJECT_TYPES.SENSOR) {
      details.moduleName = name;
    } else if (type === OBJECT_TYPES.ENVIRONMENT_TELEMETRY) {
      const parts = name.split(".");
      details.moduleName = parts[0];
      details.field = parts[1];
    } else if (type === OBJECT_TYPES.CREW_MEMBER_TELEMETRY) {
      const parts = name.split(".");
      details.moduleName = parts[0];
      // need to replace the underscore with a space
      details.crewMemberName = parts[1].replace(/_/g, " ");
      details.field = parts[2];
    } else if (type === OBJECT_TYPES.GLOBALS_METADATUM) {
      const parts = name.split(".");
      details.field = parts[1];
    }
    return { simID, details, type, subscriberID };
  }

  /**
   * Extracts a telemetry value from simulation data based on subscription details
   * @param {Object} data - The simulation data
   * @param {Object} details - The subscription details
   * @param {string} type - The subscription type
   * @returns {*} The extracted telemetry value or null if not found
   */
  #extractTelemetryValue(data, details, type) {
    if (!data) {
      return null;
    }

    let value = null;

    if (type === OBJECT_TYPES.STORE_TELEMETRY) {
      const { moduleName, field } = details;
      const moduleData = data.modules[moduleName];
      if (moduleData && moduleData.properties) {
        value = moduleData.properties[field];
      }
    } else if (type === OBJECT_TYPES.SENSOR) {
      const { moduleName } = details;
      const moduleData = data.modules[moduleName];
      if (moduleData && moduleData.properties) {
        value = moduleData.properties.value;
      }
    } else if (
      type === OBJECT_TYPES.CONSUMER_TELEMETRY ||
      type === OBJECT_TYPES.PRODUCER_TELEMETRY
    ) {
      const { moduleName, connection, flowType, flowDirection } = details;
      const moduleData = data.modules[moduleName];
      if (moduleData && moduleData[flowDirection]) {
        const flowDetails = moduleData[flowDirection];
        for (const flowDetail of flowDetails) {
          const connectionIndex = flowDetail.connections.indexOf(connection);
          if (connectionIndex !== -1) {
            const flowRates =
              flowDetail.rates[flowType.toLowerCase() + "FlowRates"];
            if (flowRates && flowRates.length > connectionIndex) {
              value = flowRates[connectionIndex];
            }
            break;
          }
        }
      }
    } else if (type === OBJECT_TYPES.GLOBALS_METADATUM) {
      const { field } = details;
      if (data.globals) {
        value = data.globals[field];
      }
    } else if (type === OBJECT_TYPES.ENVIRONMENT_TELEMETRY) {
      const { moduleName, field } = details;
      const moduleData = data.modules[moduleName];
      if (moduleData && moduleData.properties) {
        value = moduleData.properties[field];
      }
    } else if (type === OBJECT_TYPES.CREW_MEMBER_TELEMETRY) {
      const { moduleName, crewMemberName, field } = details;
      const moduleData = data.modules[moduleName];
      if (
        moduleData &&
        moduleData.properties &&
        moduleData.properties.crewPeople
      ) {
        const specificCrewMember = moduleData.properties.crewPeople.find(
          (crewMember) => crewMember.name === crewMemberName,
        );
        if (specificCrewMember) {
          value = specificCrewMember[field];
        }
      }
    }

    return value;
  }

  /**
   * Process incoming simulation data from WebSocket
   * @param {Object} data - The simulation data received from WebSocket
   * @param {number} simID - The simulation ID
   */
  #processSimulationData(data, simID) {
    if (!data) {
      return;
    }
    const timestamp = Date.now();
    // Store the data in the cache
    const simCache = this.#getOrCreateSimCache(simID);
    simCache.set(timestamp, data);
    // Process all subscriptions for this simulation ID
    Object.values(this.subscriptionsByID).forEach((subscription) => {
      const { id, details, type, callback } = subscription;
      // Check if this subscription belongs to the current simulation
      const decodedKey = decodeKey(id);
      if (decodedKey.simID !== simID.toString()) {
        return;
      }
      const value = this.#extractTelemetryValue(data, details, type);
      if (value !== null) {
        const datum = {
          id: { namespace: "biosim", key: id },
          timestamp,
          value,
        };
        callback(datum);
      }
    });
  }

  /**
   * Connect to the WebSocket for a specific simulation ID
   * @param {number} simID - The simulation ID
   */
  #connectWebSocket(simID) {
    // If already connected, return
    if (this.websocketsBySimID[simID]) {
      return;
    }
    const wsURL = `${this.baseURL.replace(/^http/, "ws")}/ws/simulation/${simID}`;
    const socket = new WebSocket(wsURL);
    socket.onopen = () => {
      console.log(`🔌 WebSocket connected for simulation ${simID}`);
    };
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.#processSimulationData(data, simID);
      } catch (error) {
        console.error("🛑 Error processing WebSocket message:", error);
      }
    };
    socket.onerror = (error) => {
      console.error(`🛑 WebSocket error for simulation ${simID}:`, error);
    };
    socket.onclose = () => {
      console.log(`🚪 WebSocket closed for simulation ${simID}`);
      // Remove from the map
      delete this.websocketsBySimID[simID];
      // Try to reconnect after a delay
      setTimeout(() => {
        if (
          Object.values(this.subscriptionsByID).some((sub) => {
            const decodedKey = decodeKey(sub.id);
            return decodedKey.simID === simID.toString();
          })
        ) {
          this.#connectWebSocket(simID);
        }
      }, 5000);
    };
    this.websocketsBySimID[simID] = socket;
  }

  /**
   * Close the WebSocket connection for a specific simulation ID
   * @param {number} simID - The simulation ID
   */
  #closeWebSocket(simID) {
    const socket = this.websocketsBySimID[simID];
    if (socket) {
      socket.close();
      delete this.websocketsBySimID[simID];
    }
  }

  // eslint-disable-next-line require-await
  async request(domainObject, options) {
    const startTelemetry = options.start;
    const endTelemetry = options.end;
    // Get telemetry details
    const { simID, details, type } = this.#createTelemetryDetails(domainObject);
    const dataToBeReturned = [];
    const simCache = this.#getOrCreateSimCache(simID);
    // Get all timestamps in the cache for this simulation ID
    const timestamps = Array.from(simCache.keys())
      .filter(
        (timestamp) => timestamp >= startTelemetry && timestamp <= endTelemetry,
      )
      .sort((a, b) => a - b);
    // Process each cached simulation data
    for (const timestamp of timestamps) {
      const data = simCache.get(timestamp);
      if (data) {
        const value = this.#extractTelemetryValue(data, details, type);
        if (value !== null) {
          const datum = {
            id: domainObject.identifier,
            value,
            timestamp,
          };
          dataToBeReturned.push(datum);
        }
      }
    }
    return dataToBeReturned;
  }

  // eslint-disable-next-line require-await
  async #buildSubscription(domainObject, callback) {
    const { simID, details, type, subscriberID } =
      this.#createTelemetryDetails(domainObject);
    // If subscription already exists, return it
    if (this.subscriptionsByID[subscriberID]) {
      return this.subscriptionsByID[subscriberID];
    }

    const subscription = {
      id: subscriberID,
      callback,
      details,
      type,
    };

    // Connect to WebSocket if not already connected
    this.#connectWebSocket(simID);
    // Get the latest cached data for this simulation ID
    const simCache = this.#getOrCreateSimCache(simID);
    const timestamps = Array.from(simCache.keys()).sort((a, b) => b - a); // Sort by timestamp descending
    // If we have cached data, process the latest one
    if (timestamps.length > 0) {
      const latestTimestamp = timestamps[0];
      const latestData = simCache.get(latestTimestamp);
      if (latestData) {
        const value = this.#extractTelemetryValue(latestData, details, type);
        if (value !== null) {
          const datum = {
            id: { namespace: "biosim", key: subscriberID },
            timestamp: latestTimestamp,
            value,
          };
          callback(datum);
        }
      }
    }

    return Promise.resolve(subscription);
  }

  supportsSubscribe(domainObject) {
    return Object.values(OBJECT_TYPES).includes(domainObject.type);
  }

  supportsRequest(domainObject) {
    return Object.values(OBJECT_TYPES).includes(domainObject.type);
  }

  subscribe(domainObject, callback) {
    const subscriberID = domainObject.identifier.key;
    this.#buildSubscription(domainObject, callback).then(
      (subscriptionDetails) => {
        this.subscriptionsByID[subscriberID] = subscriptionDetails;
      },
    );

    // Return an unsubscribe function
    return () => {
      if (this.subscriptionsByID[subscriberID]) {
        const { simID } = decodeKey(subscriberID);
        delete this.subscriptionsByID[subscriberID];
        if (this.unsubscribeFromModulesOnStop) {
          // Check if there are any remaining subscriptions for this simulation
          const hasRemainingSubscriptions = Object.values(
            this.subscriptionsByID,
          ).some((sub) => {
            const decodedKey = decodeKey(sub.id);
            return decodedKey.simID === simID;
          });
          // If no remaining subscriptions, close the WebSocket
          if (!hasRemainingSubscriptions) {
            this.#closeWebSocket(simID);
          }
        }
      }
    };
  }
}
