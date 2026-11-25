# AI Interview Coach – AI/ML Interview Question Chatbot
Node.js + Express backend, HTML/CSS/JS frontend, Google Gemini API.

## Run locally
1. Install Node.js 18+
2. `npm install`
3. Copy `.env.example` to `.env` and paste your key (free from https://aistudio.google.com/apikey)
4. `npm start` -> open http://localhost:3000

## Deploy on Render (free)
1. Push this folder to a GitHub repo (do NOT push .env)
2. render.com -> New -> Web Service -> connect repo
3. Build Command: `npm install` | Start Command: `npm start`
4. Environment -> add `GEMINI_API_KEY`
5. Deploy -> live URL: https://<name>.onrender.com
(Free plan sleeps after inactivity; first load can take ~50 sec.)
