# Multi-stage build — NovaPartage backend (Quarkus JVM, Java 21, port 8083)
#
# Build : docker build -f Dockerfile -t novapartage-backend .
# Run   : docker run -p 8083:8083 --env-file ../.env novapartage-backend

FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /build

COPY mvnw .
COPY .mvn .mvn
COPY pom.xml .
RUN chmod +x mvnw

COPY src src
RUN ./mvnw clean package -DskipTests -B

FROM eclipse-temurin:21-jre-alpine AS runtime

RUN apk add --no-cache curl su-exec \
    && addgroup -g 1001 novapartage \
    && adduser -u 1001 -G novapartage -D novapartage

WORKDIR /app

COPY --from=build --chown=novapartage:novapartage /build/target/quarkus-app /app/quarkus-app
COPY docker-entrypoint.sh /docker-entrypoint.sh

RUN chmod +x /docker-entrypoint.sh \
    && mkdir -p /app/files/temp /app/files/users \
    && chown -R novapartage:novapartage /app/files

ENV QUARKUS_PROFILE=prod \
    QUARKUS_HTTP_PORT=8083 \
    QUARKUS_HTTP_HOST=0.0.0.0 \
    APP_FILE_STORAGE_BASE_PATH=/app/files

EXPOSE 8083

VOLUME ["/app/files"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=5 \
  CMD curl -f http://localhost:8083/openapi || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
