# Stage 1: build the app
FROM docker.io/library/node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
# No dependency has install scripts; `prepare` (messages, git hooks) needs the
# sources and git, and `npm run build` compiles the messages itself.
RUN npm ci --ignore-scripts
COPY . .
# The origin for the link preview URLs is set when the container starts
# (SITE_URL, container-start.sh): build with a placeholder and move the pages
# that carry it out of dist/, leaving symlinks into the volume _site/ where the
# entrypoint writes them. Fails if any other file gets the placeholder.
RUN VITE_SITE_URL=__SITE_URL__ npm run build \
    && cd dist \
    && test "$(grep -rl __SITE_URL__ . | sort | tr '\n' ' ')" = "./index.html ./s/index.html " \
    && mkdir -p ../site/s _site \
    && mv index.html ../site/ && mv s/index.html ../site/s/ \
    && ln -s _site/index.html index.html \
    && ln -s ../_site/s/index.html s/index.html

# Stage 2: only the build, static-web-server and a shell for the entrypoint
# (Alpine variant), no Node, no sources. The catalog is not part of the image:
# mount it read-only at /public/catalog.
FROM docker.io/joseluisq/static-web-server:2-alpine
COPY static-web-server.toml /etc/static-web-server.toml
COPY --from=build /app/dist /public
COPY --from=build /app/site /opt/zeiteisen/site
COPY --chmod=755 container-start.sh /usr/local/bin/zeiteisen-start
# The base image switches to its own user; root only for this step
USER root
RUN chown 65534:65534 /public/_site
# Writable even with a read-only root filesystem; rewritten on every start
VOLUME /public/_site
ENV SERVER_CONFIG_FILE=/etc/static-web-server.toml
# Origin for the link preview URLs, e.g. https://zeiteisen.example.org
ENV SITE_URL=
# Not root (nobody); port 8080 needs no privileges
USER 65534:65534
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/zeiteisen-start"]
