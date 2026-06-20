FROM nginx:1.25-alpine

# Remove a configuração padrão do nginx
RUN rm /etc/nginx/conf.d/default.conf

# Copia configuração de segurança customizada
COPY nginx.conf /etc/nginx/conf.d/clinicflow.conf

# Copia apenas os arquivos de produção necessários
# Não copia: *.sql, *-fixes.js, clinicflow.html, Dockerfile
COPY index.html        /usr/share/nginx/html/
COPY supabase_patch.js /usr/share/nginx/html/
COPY security_patch.js /usr/share/nginx/html/

EXPOSE 80
