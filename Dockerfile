FROM node:20-alpine

# Install git so we can clone the repo
RUN apk add --no-cache git

# Clone the repository and build the project
RUN git clone https://github.com/scottbell/openmct-biosim /app/openmct-biosim
WORKDIR /app/openmct-biosim
RUN npm install && npm run build:example

# Expose port 9091 and specify the command to start the server
EXPOSE 9091
CMD ["npm", "start"]