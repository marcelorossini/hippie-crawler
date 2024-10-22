# Etapa 1: Build
FROM node:18-alpine AS build

# Defina o diretório de trabalho
WORKDIR /src

# Copie o package.json e package-lock.json para a etapa de build
COPY /src/package*.json ./

# Instale as dependências
RUN npm install --ignore-scripts --only=production

# Copie o restante dos arquivos da aplicação
COPY /src /src

# Etapa 2: Imagem final
FROM jlesage/baseimage-gui:alpine-3.15-v4
VOLUME ["/src/storage"]

# Instale pacotes adicionais necessários
RUN add-pkg xterm wget bash udev ttf-freefont chromium chromium-chromedriver

RUN apk add --no-cache nodejs npm

# pm2
RUN npm install pm2 -g
RUN mkdir /root/.pm2
RUN chmod -R 777 /root/.pm2

# Copie o script de inicialização
COPY startapp.sh /startapp.sh

# Torne o script de inicialização executável
RUN chmod +x /startapp.sh

# Copie os arquivos do build da primeira etapa
COPY --from=build /src /src

# Defina o diretório de trabalho
WORKDIR /src

RUN chmod -R 777 .

# Set the name of the application
RUN set-cont-env APP_NAME "Xterm"

# Comando para iniciar a aplicação
#CMD ["/startapp.sh"]
