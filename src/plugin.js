export default function installBiosimPlugin(options) {
    // Set default base URL for BioSim API endpoints.
    // You can override this by passing an options.baseUrl.
    const defaultBaseUrl = (options && options.baseUrl) ? options.baseUrl : 'http://localhost:8009';

    // Utility function for fetching JSON data with error handling.
    async function fetchJSON(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Error fetching ${url}: ${response.statusText}`);
        }
        return response.json();
    }

    return function install(openmct) {
        // Register the object types.
        openmct.types.addType('biosim.simulation.root', {
            name: 'BioSim Simulation Root',
            description: 'Container for BioSim simulation instances.',
            cssClass: 'icon-folder'
        });

        openmct.types.addType('biosim.simulation', {
            name: 'BioSim Simulation Instance',
            description: 'A simulation instance from BioSim',
            cssClass: 'icon-simulation'
        });

        openmct.types.addType('biosim.sim.modules', {
            name: 'SimModules',
            description: 'Modules used in the simulation',
            cssClass: 'icon-dictionary'
        });

        openmct.types.addType('biosim.sim.sensors', {
            name: 'Sensors',
            description: 'Sensors used in the simulation',
            cssClass: 'icon-telemetry'
        });

        openmct.types.addType('biosim.sim.actuators', {
            name: 'Actuators',
            description: 'Actuators used in the simulation',
            cssClass: 'icon-telemetry'
        });

        openmct.types.addType('biosim.sim.globals', {
            name: 'Globals',
            description: 'Global simulation settings from BioSim',
            cssClass: 'icon-telemetry'
        });

        // Register a provider to fetch BioSim simulation data.
        openmct.objects.addProvider('biosim', {
            async get(identifier) {
                // Root object: list all simulation IDs.
                if (identifier.key === 'biosim.simulation.root') {
                    const simulationsData = await fetchJSON(`${defaultBaseUrl}/api/simulation`);
                    return {
                        identifier,
                        name: 'BioSim Simulations',
                        type: 'biosim.simulation.root',
                        location: 'ROOT',
                        composition: simulationsData.simulations.map(simId => ({
                            key: 'biosim.simulation',
                            namespace: 'biosim',
                            id: simId.toString()
                        }))
                    };
                }

                // A simulation instance: get detailed configuration.
                if (identifier.key === 'biosim.simulation') {
                    const simId = identifier.id; // use id as the simulation identifier
                    const detail = await fetchJSON(`${defaultBaseUrl}/api/simulation/${simId}`);
                    return {
                        identifier,
                        name: `Instance ${simId}`,
                        type: 'biosim.simulation',
                        location: 'biosim.simulation.root',
                        composition: [
                            { key: 'biosim.sim.modules', namespace: 'biosim', id: `${simId}:modules` },
                            { key: 'biosim.sim.sensors', namespace: 'biosim', id: `${simId}:sensors` },
                            { key: 'biosim.sim.actuators', namespace: 'biosim', id: `${simId}:actuators` },
                            { key: 'biosim.sim.globals', namespace: 'biosim', id: `${simId}:globals` }
                        ],
                        detail: detail
                    };
                }

                // SimModules category: list all keys from the 'modules' section.
                if (identifier.key === 'biosim.sim.modules') {
                    // identifier.id is in the form "simId:modules"
                    const [simId] = identifier.id.split(':');
                    const detail = await fetchJSON(`${defaultBaseUrl}/api/simulation/${simId}`);
                    const modules = Object.keys(detail.modules || {}).map(moduleName => ({
                        key: 'biosim.module',
                        namespace: 'biosim',
                        id: `${simId}:${moduleName}`
                    }));
                    return {
                        identifier,
                        name: 'SimModules',
                        type: 'biosim.sim.modules',
                        composition: modules
                    };
                }

                // Sensors category: filter modules that include a 'sensor' property.
                if (identifier.key === 'biosim.sim.sensors') {
                    // identifier.id is in the form "simId:sensors"
                    const [simId] = identifier.id.split(':');
                    const detail = await fetchJSON(`${defaultBaseUrl}/api/simulation/${simId}`);
                    const sensors = Object.entries(detail.modules || {})
                        .filter(([name, mod]) => mod.sensor)
                        .map(([moduleName]) => ({
                            key: 'biosim.sensor',
                            namespace: 'biosim',
                            id: `${simId}:${moduleName}`
                        }));
                    return {
                        identifier,
                        name: 'Sensors',
                        type: 'biosim.sim.sensors',
                        composition: sensors
                    };
                }

                // Actuators category: filter modules that include an 'actuator' property.
                if (identifier.key === 'biosim.sim.actuators') {
                    // identifier.id is in the form "simId:actuators"
                    const [simId] = identifier.id.split(':');
                    const detail = await fetchJSON(`${defaultBaseUrl}/api/simulation/${simId}`);
                    const actuators = Object.entries(detail.modules || {})
                        .filter(([name, mod]) => mod.actuator)
                        .map(([moduleName]) => ({
                            key: 'biosim.actuator',
                            namespace: 'biosim',
                            id: `${simId}:${moduleName}`
                        }));
                    return {
                        identifier,
                        name: 'Actuators',
                        type: 'biosim.sim.actuators',
                        composition: actuators
                    };
                }

                // Globals category: directly return the globals.
                if (identifier.key === 'biosim.sim.globals') {
                    // identifier.id is in the form "simId:globals"
                    const [simId] = identifier.id.split(':');
                    const detail = await fetchJSON(`${defaultBaseUrl}/api/simulation/${simId}`);
                    return {
                        identifier,
                        name: 'Globals',
                        type: 'biosim.sim.globals',
                        composition: [],
                        detail: detail.globals
                    };
                }

                // Individual module details.
                if (identifier.key === 'biosim.module') {
                    const [simId, moduleName] = identifier.id.split(':');
                    const detail = await fetchJSON(`${defaultBaseUrl}/api/simulation/${simId}`);
                    return {
                        identifier,
                        name: moduleName,
                        type: 'biosim.module',
                        composition: [],
                        detail: detail.modules[moduleName]
                    };
                }

                // Individual sensor details.
                if (identifier.key === 'biosim.sensor') {
                    const [simId, sensorName] = identifier.id.split(':');
                    const detail = await fetchJSON(`${defaultBaseUrl}/api/simulation/${simId}`);
                    return {
                        identifier,
                        name: sensorName,
                        type: 'biosim.sensor',
                        composition: [],
                        detail: detail.modules[sensorName].sensor
                    };
                }

                // Individual actuator details.
                if (identifier.key === 'biosim.actuator') {
                    const [simId, actuatorName] = identifier.id.split(':');
                    const detail = await fetchJSON(`${defaultBaseUrl}/api/simulation/${simId}`);
                    return {
                        identifier,
                        name: actuatorName,
                        type: 'biosim.actuator',
                        composition: [],
                        detail: detail.modules[actuatorName].actuator
                    };
                }

                return {};
            },
            async query() {
                return [];
            }
        });

        // Register the root object—this is where Open MCT will start the object tree.
        openmct.objects.addRoot({
            namespace: 'biosim',
            key: 'biosim.simulation.root'
        });

        // (Optional) A composition provider so that child objects are automatically loaded.
        openmct.composition.addProvider({
            appliesTo: function (identifier) {
                return [
                    'biosim.simulation.root',
                    'biosim.simulation',
                    'biosim.sim.modules',
                    'biosim.sim.sensors',
                    'biosim.sim.actuators',
                    'biosim.sim.globals'
                ].includes(identifier.key);
            },
            load: async function (parent) {
                const obj = await openmct.objects.get(parent);
                return obj.composition;
            }
        });
    };
}