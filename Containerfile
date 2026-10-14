# Stage 1: build the app
FROM docker.io/library/node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
# No dependency has install scripts; `prepare` (messages, git hooks) needs the
# sources and git, and `npm run build` compiles the messages itself.
RUN npm ci --ignore-scripts
COPY . .
# Origin for the link preview image URLs; empty = no image, the build warns.
ARG VITE_SITE_URL=
RUN npm run build

# Stage 2: only the build and static-web-server, no Node, no sources. The
# catalog is not part of the image: mount it read-only at /public/catalog.
FROM docker.io/joseluisq/static-web-server:2
COPY static-web-server.toml /etc/static-web-server.toml
COPY --from=build /app/dist /public
ENV SERVER_CONFIG_FILE=/etc/static-web-server.toml
# Not root (nobody); port 8080 needs no privileges
USER 65534:65534
EXPOSE 8080
