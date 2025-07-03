FROM postgres:13

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