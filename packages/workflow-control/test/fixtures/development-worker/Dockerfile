ARG BASE=agent-platform-lifecycle-base:fixture
FROM ${BASE}
USER root
RUN printf '#!/bin/sh\nexec node /opt/development-worker.mjs\n' > /usr/local/bin/codex && chmod 755 /usr/local/bin/codex
COPY worker.mjs /opt/development-worker.mjs
USER node
