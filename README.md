# 🧠 Distributed Knowledge Base

A high-performance desktop Personal Knowledge Base (PKB) application designed for Computer Science students. Built with **Rust** for the backend and **MongoDB Sharded Cluster** for distributed data storage.

![Rust](https://img.shields.io/badge/Rust-Backend-orange)
![Tauri](https://img.shields.io/badge/Tauri-v2-blue)
![React](https://img.shields.io/badge/React-Frontend-61DAFB)
![MongoDB](https://img.shields.io/badge/MongoDB-Sharded_Cluster-green)

## ✨ Features

*   **Distributed Architecture:** Runs on a local Dockerized MongoDB Cluster (Config Server + 3 Shards + Router).
*   **Performance:** Native Rust backend using `tokio` and `futures` for async DB operations.
*   **Smart Search:** Full-Text Search capabilities using MongoDB Text Indexes.
*   **Rich Content:** Markdown support with syntax highlighting (Rust, JS, SQL, etc.) and Image embedding (Base64).
*   **Desktop Experience:** Built with Tauri for a lightweight and secure native feel.

## 🛠️ Tech Stack

*   **Core:** Rust, Tauri
*   **Frontend:** React, TypeScript, Vite
*   **Database:** MongoDB (Sharding Strategy: Hashed Sharding by `_id`)
*   **DevOps:** Docker, Docker Compose

## 🚀 How to Run

### 1. Start the Database Cluster
The application requires a running MongoDB Sharded Cluster.
```bash
cd docker
docker-compose up -d
# (Optional) First time setup requires initializing replica sets and shards via mongosh
2. Run the Application
npm install
npm run tauri dev
🏗️ Architecture
graph TD
    UI[React Frontend] <--> Tauri[Tauri/Rust Core]
    Tauri <--> Mongos[Mongos Router]
    Mongos <--> Config[Config Server]
    Mongos <--> Shard1[Shard 01]
    Mongos <--> Shard2[Shard 02]
    Mongos <--> Shard3[Shard 03]

```
## ⚙️ MongoDB Cluster Initialization (First Run Only)

Since this project uses a distributed **Sharded Cluster**, simply running `docker-compose up` is not enough. You must initialize the Replica Sets and add Shards to the Router manually once.

Follow these steps after running `docker-compose up -d`:

### 1. Initialize Config Server
```bash
docker exec -it configsvr mongosh --port 27019
```
Inside the Mongo shell, run:
```javascript
rs.initiate({ _id: "rs-config", configsvr: true, members: [{ _id: 0, host: "configsvr:27019" }] })
// Type 'exit' to leave
```

### 2. Initialize Shards (Storage Nodes)

**Shard 1:**
```bash
docker exec -it shard1 mongosh --port 27018
```
```javascript
rs.initiate({ _id: "rs-shard1", members: [{ _id: 0, host: "shard1:27018" }] })
```

**Shard 2:**
```bash
docker exec -it shard2 mongosh --port 27020
```
```javascript
rs.initiate({ _id: "rs-shard2", members: [{ _id: 0, host: "shard2:27020" }] })
```

**Shard 3:**
```bash
docker exec -it shard3 mongosh --port 27021
```
```javascript
rs.initiate({ _id: "rs-shard3", members: [{ _id: 0, host: "shard3:27021" }] })
```

### 3. Connect Shards to Router (Mongos)
This is the entry point for the application.
```bash
docker exec -it mongos mongosh --port 27017
```
Run these commands one by one to add shards to the cluster:
```javascript
sh.addShard("rs-shard1/shard1:27018")
sh.addShard("rs-shard2/shard2:27020")
sh.addShard("rs-shard3/shard3:27021")
```

### 4. Enable Sharding for the App
Still inside the `mongos` router shell, configure the database distribution strategy (Hashed Sharding):

```javascript
// 1. Switch to our database
use knowledge_base

// 2. Enable sharding for the DB
sh.enableSharding("knowledge_base")

// 3. Create a hashed index on the ID field (required for hashed sharding)
db.notes.createIndex({ _id: "hashed" })

// 4. Shard the collection
sh.shardCollection("knowledge_base.notes", { _id: "hashed" })
```

### 5. Verification
Check if the cluster is healthy and balanced:
```javascript
sh.status()
```
