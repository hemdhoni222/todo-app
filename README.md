# Todo List Application

A full-stack todo list application built with React (frontend) and Node.js/Express (backend).

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (running locally on port 27017)

## Installation

1. Clone the repository
2. Install dependencies for both frontend and backend:

```bash
# Install frontend dependencies
cd frontend
npm install

# Install backend dependencies
cd ../backend
npm install
```

## Running the Application

1. Start the backend server:
```bash
cd backend
npm run dev
```

2. In a new terminal, start the frontend development server:
```bash
cd frontend
npm start
```

The application will be available at http://localhost:3000

## Features

- Add new todos
- Mark todos as complete/incomplete
- Delete todos
- Persistent storage with MongoDB
- Responsive design

## Technologies Used

- Frontend:
  - React
  - Axios for API calls
  - CSS for styling

- Backend:
  - Node.js
  - Express
  - MongoDB with Mongoose
  - CORS for cross-origin requests
