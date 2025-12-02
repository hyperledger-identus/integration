FROM postgres:18@sha256:5ec39c188013123927f30a006987c6b0e20f3ef2b54b140dfa96dac6844d883f

# Copy the initialization scripts into the Docker image
COPY resources/postgres-init-script.sh /docker-entrypoint-initdb.d/init-script.sh
COPY resources/postgres-max_conns.sql /docker-entrypoint-initdb.d/max_conns.sql

# Set environment variables for multiple databases and user/password
ENV POSTGRES_MULTIPLE_DATABASES="pollux,connect,agent,node_db"
ENV POSTGRES_USER="postgres"
ENV POSTGRES_PASSWORD="postgres"

# Make the shell script executable (important!)
RUN chmod +x /docker-entrypoint-initdb.d/init-script.sh

# Expose the PostgreSQL port
EXPOSE 5432