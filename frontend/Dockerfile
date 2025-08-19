FROM node:20

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]



# This Dockerfile is for the frontend of the IoT Farm Dashboard application.
# It sets up a Node.js environment, installs dependencies, and starts the application in development mode.
# The application will be accessible on port 3000.
# Make sure to adjust the CMD if you have a different start script in your package.json.
# The Dockerfile assumes that the frontend code is in the same directory as this Dockerfile.
# If your application uses a different port or has specific environment variables, adjust the EXPOSE and CMD lines accordingly.
# This Dockerfile is designed to work with the docker-compose setup provided in the context.
# Ensure that the frontend service is correctly linked to the backend service in your docker-compose.yml
# file, so that it can communicate with the backend API.
# The frontend service will be built from the context of the ../frontend directory relative to the docker-compose.yml file.
# The application will be served in development mode, which is suitable for local development
# but may need to be adjusted for production use.
# If you need to run the application in production mode, consider using a different command in the
# CMD line, such as "npm run build" followed by "npm start" to serve the built application.
# Make sure to test the Dockerfile locally before deploying it in a production environment.
# You can build the Docker image using the command:
# docker build -t iot-farm-frontend .
# And run it using:
# docker run -p 3000:3000 iot-farm-frontend
# This will expose the frontend application on port 3000 of your host machine.
# Ensure that you have the necessary dependencies in your package.json file for the frontend to work correctly.
# If you have any additional environment variables or configurations needed for the frontend,
# you can add them to the docker-compose.yml file under the frontend service section.       