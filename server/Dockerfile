# Use an official Node.js runtime as a parent image
FROM node:22-alpine

# Set the working directory in the container
WORKDIR /usr/src/app

# Add a non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy package.json and package-lock.json
COPY package*.json ./

# Install app dependencies
RUN npm install

# Copy the rest of the application source code
COPY . .

# Create 'uploads' and 'db' directories and set permissions
RUN mkdir -p uploads/db && chown -R appuser:appgroup .

# Switch to the non-root user
USER appuser

# Expose the port the app runs on
EXPOSE 52443

# Define the default command to run the application
CMD [ "node", "server.js" ]