# Stage 1: Build Stage
FROM node:20-alpine AS builder
RUN apk add --no-cache git
RUN git clone https://github.com/scottbell/openmct-biosim /app/openmct-biosim
WORKDIR /app/openmct-biosim
RUN npm install && npm run build:prod

# Stage 2: Production Stage with NGINX
FROM nginx:alpine
ENV NGINX_ENTRYPOINT_QUIET_LOGS=1
# Update the default nginx.conf to disable access logs and reduce error log verbosity:
    RUN sed -i 's/access_log .*/access_log off;/' /etc/nginx/nginx.conf && \
    sed -i 's/error_log .*/error_log \/var\/log\/nginx\/error.log crit;/' /etc/nginx/nginx.conf

RUN mkdir -p /usr/share/nginx/html/openmct
COPY --from=builder /app/openmct-biosim/node_modules/openmct/dist/ /usr/share/nginx/html/openmct/
COPY --from=builder /app/openmct-biosim/dist/openmct-biosim.js.map /usr/share/nginx/html
COPY --from=builder /app/openmct-biosim/dist/openmct-biosim.js /usr/share/nginx/html
COPY --from=builder /app/openmct-biosim/etc/prod/index.js /usr/share/nginx/html/
COPY --from=builder /app/openmct-biosim/etc/prod/index.html /usr/share/nginx/html/
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]