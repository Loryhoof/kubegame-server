# Kubegame Server

Kubegame is a sandbox-style multiplayer browser game built with **three.js**.
This repository contains the **server-side** implementation, which manages game state, synchronization, and authoritative logic.

The **frontend** client (rendering, controls, etc.) lives in a separate repository.

---

## Features

* Authoritative multiplayer server
* Built with **Express** and **Socket.IO**
* Written in **TypeScript**
* Supports both **desktop** and **mobile browsers**

---

## Requirements

* [Node.js](https://nodejs.org/) (v16 or newer recommended)
* npm (comes with Node.js)

---

## Setup

1. **Clone the repo**

   ```bash
   git clone https://github.com/loryhoof/kubegame-server.git
   cd kubegame-server
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**
   Create a `.env` file in the project root.

   **Development** (default port: `3000`):

   ```env
   PORT=3000
   ENVIRONMENT=DEV
   ```

   **Production**:

   ```env
   PORT=443
   ENVIRONMENT=PROD
   ```

4. **Run the server**

   ```bash
   npm run dev
   ```
   
---

## Related Repositories

* [kubegame](https://github.com/loryhoof/kubegame) – the client-side implementation (three.js + UI + mobile controls)

