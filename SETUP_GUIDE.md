# Hospilot Local Setup Guide

Welcome to the Hospilot team! This guide will walk you through the process of setting up the project on your local machine so you can develop and test alongside the rest of the team.

Because we are using a **Shared Database Engine (Supabase)**, you won't need to worry about running complex database migrations, schema setups, or Hasura metadata tracking. All of the database schema configurations and relationships are securely stored centrally and will automatically sync when you spin up your environment.

## Prerequisites

Before you begin, ensure you have the following installed on your machine:
- [Git](https://git-scm.com/downloads)
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [Docker & Docker Compose](https://www.docker.com/products/docker-desktop/)
- [Python 3.11+](https://www.python.org/downloads/) (for backend/framework development)

---

## Step-by-Step Setup

### 1. Clone the Repository
Clone the main branch of our repository to your local machine:
```bash
git clone https://github.com/cobra-008/CuraFlow.git
cd CuraFlow
```

### 2. Configure Environment Variables
You will receive a secure package containing the `.env` files from the project lead. 
Place these files in their respective directories within the project:

- Place the framework `.env` file in: `agentic-framework/.env`
- Place the web `.env` file in: `web/.env`

> **Note:** These files contain the connection strings to our shared Supabase database. Since we all connect to the same development database, you will instantly see the same data and configurations as everyone else!

### 3. Start the Backend Infrastructure
We use Docker Compose to orchestrate our backend services (Hasura, Kafka, Redis, Temporal, Fabric, and the Agentic Framework Backend). 

Run the following command from the root of the project to download the images and spin up the entire backend stack in the background:
```bash
docker compose -f deployments/docker-compose.agentic-framework.yml -f deployments/docker-compose.fabric.yml -f deployments/docker-compose.hasura.yml up -d
```
*Tip: The first time you run this, it may take a few minutes to download all the necessary Docker images.*

### 4. Verify Backend Health
Once the containers are up, you can verify that the core services are running:
- **Hasura Console:** Open `http://localhost:8080/console`
- **Temporal UI:** Open `http://localhost:8088`
- **Backend API:** Check `http://localhost:8000/health` (should return `{"status":"ok"}`)

### 5. Start the Web Frontend
Now that the backend is running and connected to our shared database, you can start the React frontend.

Navigate to the `web` directory, install the Node dependencies, and start the development server:
```bash
cd web
npm install
npm run dev
```

### 6. Log In and Test
Open your browser and navigate to `http://localhost:3000`. You should see the Hospilot login screen. 
Since you are connected to the shared database, you can immediately log in using the standard admin credentials or view the same pending sign-ups as the rest of the team.

---

## Git Branching Workflow

To ensure we don't accidentally overwrite each other's code, **everyone should work on their own branches** rather than directly on `main`.

### 1. Create and switch to a new branch
Before starting any new feature or bug fix, create a new branch from `main`:
```bash
# Make sure you're up to date first
git checkout main
git pull origin main

# Create and switch to your new branch (replace 'feature/my-new-idea' with your branch name)
git checkout -b feature/my-new-idea
```

### 2. Make changes and commit
As you work, save your changes to your branch:
```bash
# Stage your modified files
git add .

# Commit with a descriptive message
git commit -m "Add new dashboard component"
```

### 3. Push and Merge
When you're completely done and ready to share your work:
```bash
# Push your branch to GitHub
git push -u origin feature/my-new-idea
```
After pushing, go to the GitHub repository in your browser and open a **Pull Request (PR)** to merge your branch into `main`. Once approved, you can merge it in!

---

## Troubleshooting

- **`Failed to fetch` or `500 Internal Server Error` on Login:** This usually means your Docker containers haven't finished booting up, or Docker networking has a glitch. Run `docker compose ... down` (using the same 3 files) and then bring them back `up -d`. 
- **Missing Columns/Schema Errors:** Because Hasura metadata is stored in the shared Supabase instance (`hdb_catalog`), your local Hasura container will read the correct metadata automatically. If you ever experience schema desyncs, you can force your local Hasura engine to reload the metadata by restarting its container: `docker restart hospilot-oss-hasura-1`.

Happy coding!
