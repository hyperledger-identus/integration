FROM mongo:6.0

# Copy the initialization script
COPY resources/mongo-initdb.js /docker-entrypoint-initdb.d/initdb.js

# Command to start MongoDB with authentication
CMD ["--auth"]

# Expose the MongoDB port
EXPOSE 27017
