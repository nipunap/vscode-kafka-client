# Temporary Files

This folder contains test scripts and temporary files for development and testing.

## Files

- **test-kafka.js** - Diagnostic script to test Kafka connectivity and topic operations
- **docker-compose.yml** - Docker Compose configuration for running a local Kafka instance

## Usage

### Test Kafka Connection

Run the diagnostic script to verify your Kafka setup:

```bash
node test-kafka.js
```

This will:
- Test connection to localhost:9092
- List existing topics
- Display cluster information
- Test topic creation and deletion

### Start Local Kafka with Docker

```bash
docker-compose up -d
```

This starts a single Kafka broker on localhost:9092 using Apache Kafka with KRaft (no Zookeeper needed).

To stop:
```bash
docker-compose down
```

## Notes

Files in this directory are gitignored and used for development/testing only.
