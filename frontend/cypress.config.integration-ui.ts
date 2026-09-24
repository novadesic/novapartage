import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/integration/**/*.cy.{js,ts}',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: true,
    screenshotOnRunFailure: true,

    slowTestThreshold: 5000,
    defaultCommandTimeout: 30000,
    requestTimeout: 30000,
    responseTimeout: 30000,
    pageLoadTimeout: 60000,
    watchForFileChanges: false,

    setupNodeEvents(on, config) {
      config.env = {
        ...config.env,
        FRONTEND_URL: 'http://localhost',
        AUTH_URL: 'http://localhost/auth',
        BACKEND_URL: 'http://localhost/backend',
        MAILPIT_URL: 'http://localhost:8025',
        CYPRESS_TEST_EMAIL: 'cypress@example.com',
        SLOW_MODE: true,
        COMMAND_DELAY: 2000,
        STEP_DELAY: 5000,
      }
      return config
    },
  },

  component: {
    devServer: {
      framework: 'angular',
      bundler: 'webpack',
    },
    specPattern: '**/*.cy.ts'
  },
})
