FROM postgres:13@sha256:4689940c683801b4ab839ab3b0a0a3555a5fe425371422310944e89eca7d8068

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