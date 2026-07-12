# Stage 1: Build the React application
FROM node:20-alpine AS build
WORKDIR /app

# Copia os arquivos de dependência
COPY package*.json ./

# Instala todas as dependências
RUN npm install

# Copia o restante do código fonte do app
COPY . .

# Declara as variáveis de ambiente necessárias durante a compilação do Vite (Build Time)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

# Compila o app de produção
RUN npm run build

# Stage 2: Serve os arquivos estáticos usando Nginx
FROM nginx:1.25-alpine

# Remove a configuração padrão do Nginx
RUN rm /etc/nginx/conf.d/default.conf

# Copia nossa configuração customizada para suporte a SPA (Single Page Application)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copia os arquivos compilados do estágio anterior
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
