# BioSim Plugin for Open MCT
This project provides a plugin for connecting [Open MCT](https://github.com/nasa/openmct) to [BioSim](https://github.com/scottbell/biosim).

<img width="1607" alt="biosim-with-openmct" src="https://github.com/user-attachments/assets/0853290a-9d0a-4646-94aa-e8635f3fe027" />

# Requirements
* Get the latest [Node JS](https://nodejs.org/en/download)
* Install [BioSim](https://github.com/scottbell/biosim)

# Installation
```
git clone https://github.com/scottbell/openmct-biosim
cd openmct-biosim
npm install && npm run build:dev
npm start
```

This should build for development and run the Open MCT development server. After the server has started, launch a web browser pointing to http://localhost:9091/
If you start a simulation, you'll see details of all the aspects of the simulation.

This will start the Open MCT web application connected to a running BioSim server on `http://localhost:8009`.
Note you can change the hostname/IP of the BioSim server in `etc/dev/index.js` as the option `baseUrl` to the plugin constructor.
