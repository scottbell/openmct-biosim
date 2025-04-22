# Stage 1: Build Stage
FROM node:20-alpine AS builder
RUN apk add --no-cache git
RUN git clone https://github.com/scottbell/openmct-biosim /app/openmct-biosim
WORKDIR /app/openmct-biosim
RUN npm install && npm run build:prod

# Stage 2: Production Stage with NGINX
FROM nginx:alpine
RUN mkdir -p /usr/share/nginx/html/openmct
COPY --from=builder /app/openmct-biosim/node_modules/openmct/dist/*  /usr/share/nginx/html/openmct
COPY --from=builder /app/openmct-biosim/dist/openmct-biosim.js.map /usr/share/nginx/html
COPY --from=builder /app/openmct-biosim/dist/openmct-biosim.js /usr/share/nginx/html
COPY --from=builder /app/openmct-biosim/etc/prod/index.js /usr/share/nginx/html/
COPY --from=builder /app/openmct-biosim/etc/prod/index.html /usr/share/nginx/html/
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]