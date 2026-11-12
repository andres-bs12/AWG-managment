FROM eclipse-temurin:21-jdk AS build
WORKDIR /app
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw -q dependency:go-offline
COPY src/ src/
RUN ./mvnw -q -DskipTests package

FROM eclipse-temurin:21-jre
RUN groupadd --system awg && useradd --system --gid awg --home-dir /app awg \
    && mkdir -p /app /data/uploads && chown -R awg:awg /app /data/uploads
WORKDIR /app
COPY --from=build --chown=awg:awg /app/target/awg-tracking-0.0.1-SNAPSHOT.jar /app/app.jar
ENV UPLOADS_DIR=/data/uploads
VOLUME ["/data/uploads"]
USER awg
EXPOSE 8080
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=70", "-XX:+ExitOnOutOfMemoryError", "-jar", "/app/app.jar"]
