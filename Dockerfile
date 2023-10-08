FROM node:20

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src

ENV CRON="*/10 * * * * *"
ENV OUTPUT_DIR="/output"

VOLUME output

CMD [ "npm", "run", "start" ]
