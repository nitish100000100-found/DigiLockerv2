# DigiLocker v2

> 🎓 This is the improved / v2 version of my **very first project (DigiLocker)**. Same core idea, but this time with cloud storage integration.
## About

DigiLockerv2 is a document-locker style web application where users can securely upload, store, and manage their documents. Compared to v1, it adds **Cloudinary integration**, so files are properly stored on the cloud instead of just the local disk.

## What's New in v2

- ☁️ **Cloudinary integration** added — file uploads are now handled through cloud storage (alongside/instead of local Multer storage)


## Tech Stack

- **Backend:** Node.js + Express 5
- **Templating:** EJS
- **Database:** MongoDB (via Mongoose)
- **Auth & Sessions:** express-session + connect-mongodb-session (MongoDB-backed sessions)
- **Password Security:** bcryptjs
- **File Uploads:** Multer + **Cloudinary**
- **Validation:** express-validator
- **Containerization:** Dockerfile included

## Features

- User signup/login with hashed passwords (bcryptjs)
- Session-based authentication (sessions stored in MongoDB)
- Upload and manage documents — now backed by Cloudinary for cloud storage
- Server-side rendered views (EJS)
- Input validation on forms

## Project Structure

```
├── public/         # static assets (CSS, JS, images)
├── uploads/         # local uploaded documents (before/alongside Cloudinary)
├── views/            # EJS templates
├── app.js            # app entry point
├── user.js           # user model/logic
├── Dockerfile
└── package.json
```

## Getting Started

```bash
# clone the repo
git clone https://github.com/nitish100000100-found/DigiLockerv2.git
cd DigiLockerv2

# install dependencies
npm install

# set up environment variables in a .env file:
# - MongoDB connection URI
# - session secret
# - Cloudinary API credentials (cloud name, API key, API secret)

# run the app
npm start
```

The app runs via `nodemon app.js` — with auto-restart in dev mode.

## Related

The earlier version is here: [**DigiLocker (v1)**](https://github.com/nitish100000100-found/Digilocker) — my original first project.

---
*A learning project that grew out of v1, step by step. 🚀*
