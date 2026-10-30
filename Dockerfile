# Mutare: servidor Node sin dependencias que solo entrega archivos.
# Los archivos se procesan en el navegador: el contenedor no guarda nada.
FROM node:22-alpine

ENV NODE_ENV=production \
    PORT=9996 \
    HOST=0.0.0.0

WORKDIR /app
COPY --chown=node:node server.js ./
COPY --chown=node:node public ./public

USER node
EXPOSE 9996

HEALTHCHECK --interval=60s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Montón de memoria pequeño: el servidor solo sirve archivos
CMD ["node", "--max-old-space-size=48", "server.js"]
