# Imagem leve com Node 18 LTS
FROM node:18-alpine

# Diretório de trabalho
WORKDIR /app

# Copia somente os manifests primeiro (cache de dependências)
COPY package.json package-lock.json* ./

# Instala só prod deps (Cloud Run é ambiente de produção)
RUN npm ci --omit=dev

# Copia o restante do código
COPY . .

# Usa a porta fornecida pelo Cloud Run (default 8080)
ENV PORT=8080
# Certifique-se que seu index.cjs usa process.env.PORT || 3001
EXPOSE 8080

# Comando de start (precisa existir no package.json)
CMD ["npm", "start"]