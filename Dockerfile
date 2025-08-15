# 1. Используем официальный образ Node.js. 'slim' - это легковесная версия.
FROM node:18-slim

# 2. Устанавливаем системные зависимости:
#    - wget: для скачивания файлов
#    - firefox-esr: стабильная версия Firefox для серверов
#    - bzip2/tar: для распаковки архивов
#    - ca-certificates: для корректной работы HTTPS
RUN apt-get update && apt-get install -y \
    wget \
    firefox-esr \
    bzip2 \
    ca-certificates \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# 3. Скачиваем, распаковываем и устанавливаем GeckoDriver (драйвер для Firefox)
#    ВАЖНО: Проверьте последнюю версию на https://github.com/mozilla/geckodriver/releases
ENV GECKODRIVER_VERSION=v0.34.0
RUN wget --no-verbose -O /tmp/geckodriver.tar.gz https://github.com/mozilla/geckodriver/releases/download/${GECKODRIVER_VERSION}/geckodriver-${GECKODRIVER_VERSION}-linux64.tar.gz && \
    rm -rf /opt/geckodriver && \
    tar -C /opt -zxf /tmp/geckodriver.tar.gz && \
    rm /tmp/geckodriver.tar.gz && \
    mv /opt/geckodriver /usr/local/bin/geckodriver && \
    chmod +x /usr/local/bin/geckodriver

# 4. Создаем рабочую директорию внутри контейнера
WORKDIR /usr/src/app

# 5. Копируем package.json и устанавливаем зависимости Node.js
#    Это делается отдельно для кэширования Docker-слоев
COPY package*.json ./
RUN npm install

# 6. Копируем остальной код нашего приложения
COPY . .

# 7. Указываем команду, которая будет запускать бота при старте контейнера
CMD [ "node", "bot.js" ]
