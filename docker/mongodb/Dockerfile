FROM mongo:8.2@sha256:bf5995bcccb65725aa81fd92e68449323c94b96bf1c1fa9f7acbc2a8ad518114

# Copy the initialization script
COPY resources/mongo-initdb.js /docker-entrypoint-initdb.d/initdb.js

# Command to start MongoDB with authentication
CMD ["--auth"]

# Expose the MongoDB port
EXPOSE 27017
