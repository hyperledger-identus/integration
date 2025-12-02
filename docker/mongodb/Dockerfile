FROM mongo:8.2@sha256:7245ffb851d149dbfac67397caf91bae4974d899972f9fd1d8985fc6eea3c13d

# Copy the initialization script
COPY resources/mongo-initdb.js /docker-entrypoint-initdb.d/initdb.js

# Command to start MongoDB with authentication
CMD ["--auth"]

# Expose the MongoDB port
EXPOSE 27017
