FROM node:20-alpine

# Install git so we can clone repositories
RUN apk add --no-cache git

# Clone and set up Open MCT in /opt/openmct, then link it globally
RUN git clone https://github.com/nasa/openmct.git /opt/openmct && \
    cd /opt/openmct && \
    npm install && \
    npm run build && \
    npm link

# Clone the openmct-biosim repository
RUN git clone https://github.com/scottbell/openmct-biosim /app/openmct-biosim
WORKDIR /app/openmct-biosim

# Install openmct-biosim dependencies
RUN npm install

# Link the globally installed Open MCT into openmct-biosim's node_modules
RUN npm link openmct

# Expose port 9091 and start the server
EXPOSE 9091
CMD ["npm", "start"]
