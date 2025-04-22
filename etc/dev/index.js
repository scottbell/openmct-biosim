import installBiosimPlugin from "../../src/plugin.js";

const config = {
  baseUrl: "http://localhost:8009",
  telemetryDataToKeepPerSim: 1000,
  unsubscribeFromBiosimOnStop: false,
};
const openmct = window.openmct;

(function () {
  const TWO_MINUTES = 2 * 60 * 1000;

  openmct.setAssetPath("/openmct/");

  installDefaultPlugins();
  openmct.install(installBiosimPlugin(config));

  openmct.start();

  function installDefaultPlugins() {
    openmct.install(openmct.plugins.LocalStorage());
    openmct.install(openmct.plugins.Espresso());
    openmct.install(openmct.plugins.MyItems());
    openmct.install(openmct.plugins.example.Generator());
    openmct.install(openmct.plugins.example.ExampleImagery());
    openmct.install(openmct.plugins.UTCTimeSystem());
    openmct.install(openmct.plugins.TelemetryMean());

    openmct.install(
      openmct.plugins.DisplayLayout({
        showAsView: ["summary-widget", "example.imagery"],
      }),
    );
    openmct.install(
      openmct.plugins.Conductor({
        menuOptions: [
          {
            name: "Realtime",
            timeSystem: "utc",
            clock: "local",
            clockOffsets: {
              start: -TWO_MINUTES,
              end: 0,
            },
          },
          {
            name: "Fixed",
            timeSystem: "utc",
            bounds: {
              start: Date.now() - TWO_MINUTES,
              end: 0,
            },
          },
        ],
      }),
    );
    openmct.install(openmct.plugins.SummaryWidget());
    openmct.install(openmct.plugins.Notebook());
    openmct.install(openmct.plugins.LADTable());
    openmct.install(
      openmct.plugins.ClearData([
        "table",
        "telemetry.plot.overlay",
        "telemetry.plot.stacked",
      ]),
    );
  }
})();
