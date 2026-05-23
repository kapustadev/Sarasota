# 🌸 Sarasota Flowers - Warehouse Management System

Advanced web-based accounting and bouquet assembly system for floral businesses.

## 🚀 Quick Start (Local Development)

1.  **Clone or copy** this project to your directory.
2.  **Install dependencies**:
    ```bash
    npm install
    ```
3.  **Prepare the Database**:
    ```bash
    npx prisma migrate dev --name init
    node prisma/seed.js
    ```
4.  **Run the App**:
    ```bash
    npm run dev
    ```
5.  Open [http://localhost:3000](http://localhost:3000)

## 📁 Project Features

- **Inventory Tracking**: Real-time stock levels for flowers & materials.
- **Bouquet Builder**: Interactive composition with automatic price calculation.
- **Role-Based Pricing**:
  - **Owner/Accountant**: See cost & retail prices.
  - **Employee**: See ONLY retail prices.
- **QuickBooks Integration**: One-click CSV export specifically formatted for QB.
- **Modern UI**: Clean, premium design with a dark mode option.

## ☁️ Deployment (Hosting)

This project is specialized for easy hosting using **Docker**.

1.  **Build the Container**:
    ```bash
    docker build -t sarasota-flowers .
    ```
2.  **Run the Container**:
    ```bash
    docker run -p 3000:3000 sarasota-flowers
    ```

The system uses a local SQLite database file (`prisma/dev.db`). For cloud hosting like **Vercel**, it is recommended to connect an external PostgreSQL database (e.g., Supabase) by updating the `DATABASE_URL` in `.env` and `provider = "postgresql"` in `prisma/schema.prisma`.

---
*Created with 🌸 Antigravity*
