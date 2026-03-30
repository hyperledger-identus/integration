FROM mongo:8.2@sha256:d343c378b5c6e2fe373174abcf4a877be0dfc721b5d0b9d582204dccb1c00b86

# Copy the initialization script
COPY resources/mongo-initdb.js /docker-entrypoint-initdb.d/initdb.js

# Command to start MongoDB with authentication
CMD ["--auth"]

# Expose the MongoDB port
EXPOSE 27017
