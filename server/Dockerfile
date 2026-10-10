FROM node:24-alpine
WORKDIR /opt/latinio
COPY server/ ./server/
COPY google/Code.gs google/Accounts.gs ./google/
RUN mkdir /data && chown node:node /data
USER node
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:8080/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/start.mjs"]
