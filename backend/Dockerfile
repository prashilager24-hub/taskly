# Stage 1: Build the application using Maven
FROM maven:3.8.8-eclipse-temurin-17 AS builder

WORKDIR /authentificationUtilization

COPY /pom.xml /authentificationUtilization/
RUN mvn dependency:go-offline

COPY /src /authentificationUtilization/src
RUN mvn clean package spring-boot:repackage --update-snapshots

# Stage 2: Minimal runtime image
FROM eclipse-temurin:17-jdk

WORKDIR /authentificationUtilization

COPY --from=builder /authentificationUtilization/target/authentificationUtilization-0.jar authentificationUtilization.jar

# Copy the email template into the container
COPY email-template.html /authentificationUtilization/templates/email-template.html

EXPOSE 4032

ENTRYPOINT ["java", "-jar", "-Xmx512m", "-XX:+ExitOnOutOfMemoryError", "-XX:+UseG1GC", "authentificationUtilization.jar"]