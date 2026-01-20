# PSQL Buddy - Local Setup

This project is a Visual PostgreSQL Query Builder powered by Google Gemini AI.

## Prerequisites

1.  **Node.js**: Ensure you have Node.js installed (version 18+ recommended).
2.  **Gemini API Key**: You need an API key from Google AI Studio.

## Installation

1.  Clone or download this repository to your local machine.
2.  Open a terminal in the project root.
3.  Install dependencies:
    ```bash
    npm install
    ```

## Setup API Key

Create a `.env` file in the root directory and add your keys:

```env
VITE_API_KEY=your_actual_gemini_api_key_here
GH_TOKEN=your_github_personal_access_token_here
```

## How to generate GH_TOKEN for Local Release

To run `npm run dist` locally, you need a GitHub Personal Access Token:
1. Go to **GitHub Settings** > **Developer Settings** > **Personal access tokens** > **Tokens (classic)**.
2. Click **Generate new token (classic)**.
3. Select the `repo` scope (full control of private repositories).
4. Copy the generated token and paste it into your `.env` file as `GH_TOKEN=...`.

## Running Locally

Start the development server:

```bash
npm run dev
```

Build and Package (Distribution):
```bash
npm run dist
```

## Project Structure

*   `src/` (Mapped to root): Contains the application source code.
    *   `components/`: React components.
    *   `services/`: API interactions.
    *   `App.tsx`: Main application component.
*   `index.html`: Entry point.
