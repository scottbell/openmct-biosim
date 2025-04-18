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
    this.subscriptionsById = {};
    this.telemetryDataToKeepPerTopic = telemetryDataToKeepPerModule || 1000;
    this.unsubscribeFromModulesOnStop = unsubscribeFromModulesOnStop;
    this.baseURL = baseURL || "http://localhost:8009";
    this.pollingInterval = pollingInterval || 1000; // Default to 1 second
  }

  static async #pollTelemetry(url, domainObject, subscription, callback) {
    try {
      const response = await fetch(url);
      const data = await response.json();
      if (data) {
        const timestamp = Date.now();
        let value = null;
        if (subscription.type === OBJECT_TYPES.STORE_TELEMETRY) {
          const { storeField } = subscription.details;
          value = data.properties[storeField];
        } else if (subscription.type === OBJECT_TYPES.SENSOR) {
          value = data.properties.value;
        } else if (
          subscription.type === OBJECT_TYPES.CONSUMER_TELEMETRY ||
          subscription.type === OBJECT_TYPES.PRODUCER_TELEMETRY
        ) {
          const { connection, flowType, flowDirection } = subscription.details;
          const flowDetails = data[flowDirection];

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

        const datum = {
          id: domainObject.identifier,
          timestamp,
          value,
        };
        subscription.cache.set(timestamp, datum);
        callback(datum);
      }
    } catch (error) {
      console.error("Error fetching telemetry:", error);
    }
  }

  // eslint-disable-next-line require-await
  async request(domainObject, options) {
    const startTelemetry = options.start;
    const endTelemetry = options.end;
    const subscriberID = domainObject.identifier.key;
    const cache = this.subscriptionsById[subscriberID]?.cache;
    let dataToBeReturned = [];
    const cacheIterator = cache ? cache.values() : null;

    if (cacheIterator) {
      let next = cacheIterator.next();
      while (!next.done) {
        if (
          next.value &&
          next.value.timestamp >= startTelemetry &&
          next.value.timestamp <= endTelemetry
        ) {
          const datum = {
            id: domainObject.identifier,
            value: next.value.value,
            timestamp: next.value.timestamp,
          };
          dataToBeReturned.push(datum);
        }
        next = cacheIterator.next();
      }
    }
    return dataToBeReturned;
  }

  // eslint-disable-next-line require-await
  async #buildSubscription(domainObject, callback) {
    if (this.subscriptionsById[domainObject.identifier.key]) {
      return this.subscriptionsById[domainObject.identifier.key];
    }

    const id = domainObject.identifier.key;
    const { simID, name, type } = decodeKey(id);
    let moduleName = null;
    let details = {};
    if (
      type === OBJECT_TYPES.PRODUCER_TELEMETRY ||
      type === OBJECT_TYPES.CONSUMER_TELEMETRY
    ) {
      const parts = name.split(".");
      moduleName = parts[0];
      details.connection = parts[1];
      details.flowType = parts[2];
      // either "producers" or "consumers" depending on the type
      details.flowDirection =
        type === OBJECT_TYPES.PRODUCER_TELEMETRY ? "producers" : "consumers";
    } else if (type === OBJECT_TYPES.STORE_TELEMETRY) {
      const parts = name.split(".");
      moduleName = parts[0];
      details.storeField = parts[1];
    } else if (type === OBJECT_TYPES.SENSOR) {
      moduleName = name;
    }
    const url = `${this.baseURL}/api/simulation/${simID}/modules/${moduleName}`;

    const subscription = {
      id,
      moduleName,
      callback,
      details,
      type,
      cache: new LRUCache({ max: this.telemetryDataToKeepPerTopic }),
    };

    // Start periodic polling using the private static method.
    subscription.timer = setInterval(() => {
      RealtimeTelemetryProvider.#pollTelemetry(
        url,
        domainObject,
        subscription,
        callback,
      );
    }, this.pollingInterval);

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
        this.subscriptionsById[subscriberID] = subscriptionDetails;
      },
    );

    // Return an unsubscribe function that will clear the polling timer.
    return () => {
      if (this.subscriptionsById[subscriberID]) {
        clearInterval(this.subscriptionsById[subscriberID].timer);
        delete this.subscriptionsById[subscriberID];
      }
    };
  }
}
