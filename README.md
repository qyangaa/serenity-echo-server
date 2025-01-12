# Serenity Echo Server

A simple Express.js server that includes basic endpoints and an echo service.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Start the server:

```bash
node index.js
```

The server will start on port 3000 by default. You can change this by setting the `PORT` environment variable.

## Available Endpoints

- `GET /`: Welcome message
- `POST /echo`: Returns whatever JSON body you send to it
- `GET /health`: Health check endpoint

## Example Usage

Using curl to test the echo endpoint:

```bash
curl -X POST -H "Content-Type: application/json" -d '{"message":"Hello World"}' http://localhost:3000/echo
```
