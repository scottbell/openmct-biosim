const MONITORING_RESULT_CSS = {
  WATCH: "is-limit--yellow",
  WARNING: "is-limit--yellow",
  DISTRESS: "is-limit--red",
  CRITICAL: "is-limit--red",
  SEVERE: "is-limit--red",
};

export default class LimitProvider {
  constructor(openmct, realtimeTelemetryProvider) {
    this.openmct = openmct;
    this.realtimeTelemetryProvider = realtimeTelemetryProvider;
  }

  getLimitEvaluator(domainObject) {
    return {
      /**
       * Evaluates a telemetry datum for limit violations.
       *
       * @param {Datum} datum the telemetry datum from the historical or realtime plugin ({@link Datum})
       * @param {object} valueMetadata metadata about the telemetry datum
       *
       * @returns {EvaluationResult} ({@link EvaluationResult})
       */
      evaluate: function (datum, valueMetadata) {
        if (
          valueMetadata &&
          datum.monitoringResult &&
          datum.monitoringResult in MONITORING_RESULT_CSS
        ) {
          return {
            cssClass: MONITORING_RESULT_CSS[datum.monitoringResult],
            name: datum.monitoringResult,
            low: Number.NEGATIVE_INFINITY,
            high: Number.POSITIVE_INFINITY,
          };
        }
      },
    };
  }

  supportsLimits(domainObject) {
    return domainObject.type.startsWith("biosim.");
  }

  getLimits(domainObject) {
    return {
      // eslint-disable-next-line require-await
      limits: async () => {
        if (domainObject.limits) {
          return domainObject.limits;
        } else {
          return {};
        }
      },
    };
  }

  subscribeToLimits(domainObject, callback) {
    return this.realtimeTelemetryProvider.subscribeToLimits(
      domainObject,
      callback,
    );
  }
}
