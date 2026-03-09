FROM mongo:8.2@sha256:474f5c3bf0e355bb97dafda730e725169a4d51c5578abf7be9ec7ad3fdee4481

# Copy the initialization script
COPY resources/mongo-initdb.js /docker-entrypoint-initdb.d/initdb.js

# Command to start MongoDB with authentication
CMD ["--auth"]

# Expose the MongoDB port
EXPOSE 27017
