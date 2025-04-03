/* eslint-disable no-undef */
const path = require('path');

const devMode = process.env.NODE_ENV !== 'production';

const WEBPACK_CONFIG = {
    entry: () => {
        const entries = {};
        if (devMode) {
            entries['openmct-biosim-example'] = './example/index.js';
        } else {
            entries['openmct-biosim'] = './src/plugin.js';
        }

        return entries;
    },
    performance: {
        hints: false
    },
    mode: 'production',
    module: {
        rules: [
            {
                test: /\.js$/,
                enforce: "pre",
                use: ["source-map-loader"]
            }
        ]
    },
    output: {
        globalObject: "this",
        filename: '[name].js',
        path: path.resolve(__dirname, 'dist'),
        libraryTarget: 'umd',
        library: 'openmctBiosim'
    },
    devtool: devMode ? 'eval-source-map' : 'source-map',
    devServer: {
        compress: true,
        port: 9091,
        static: [{
            directory: path.join(__dirname, 'example')
        }, {
            directory: path.join(__dirname, '/node_modules/openmct/dist'),
            publicPath: '/node_modules/openmct/dist'
        }]
    }
};

module.exports = WEBPACK_CONFIG;
