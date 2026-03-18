FROM mongo:8.2@sha256:3a7947f3211e70c045ebff7e94293298bc3fa4e08e5cfcb8cb32ca0d06e06635

# Copy the initialization script
COPY resources/mongo-initdb.js /docker-entrypoint-initdb.d/initdb.js

# Command to start MongoDB with authentication
CMD ["--auth"]

# Expose the MongoDB port
EXPOSE 27017
