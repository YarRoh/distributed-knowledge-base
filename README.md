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
code
Bash
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
