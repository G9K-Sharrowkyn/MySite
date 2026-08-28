# Getting Started with Create React App

Before a public release, complete the
[pre-launch checklist](./PRELAUNCH_CHECKLIST.md). Production startup and
deployment are guarded by backend configuration and health checks.

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Setup

1. Copy `.env.example` to `.env`.
2. Install dependencies in both the root and backend directories:
   ```
   npm install
   (cd backend && npm install)
   ```
3. Run the backend and frontend servers:
   ```
   node backend/server.js
   npm start
   ```

## Google Sign-In (optional)

To enable login/register with Google:

1. In Google Cloud Console, create an OAuth 2.0 Web Client.
2. Add the frontend origin (e.g. `http://localhost:3000`, production domain) to authorized JavaScript origins.
3. Set environment variables:
   - Frontend (`.env` or `.env.production`): `REACT_APP_GOOGLE_CLIENT_ID=...`
   - Backend (`backend/.env`): `GOOGLE_CLIENT_ID=...`


## Administrator setup

No default account or password is shipped with the application. Register an
account, verify its email, set `PRIMARY_ADMIN_EMAIL` to that address in the
backend environment, and restart the backend. Never commit a database or
credentials to Git.

## Styling Overview

The interface uses a dark theme with a consistent **Roboto** font across all pages. Layouts are responsive up to 1000 px and navigation wraps on small screens. Key colors and spacing are defined using CSS variables for easier customization.

![Application screenshot](docs/screenshot.png)


## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
