# Earshot MCP server (stdio) for Glama's build-and-inspect check, or for anyone who prefers a container.
# Build from the folder that holds this Dockerfile and package.json (the repository root of the public mirror):
#   docker build -t earshot-mcp .
# Run (stdio, so -i):  docker run -i --rm earshot-mcp
# It installs only the two runtime dependencies from package-lock.json and copies src/: no tests, no scripts.
# The server makes no network calls, so the container needs none at run time.
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY src ./src
USER node
ENTRYPOINT ["node", "/app/src/server.mjs"]
