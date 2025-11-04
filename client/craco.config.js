module.exports = {
  devServer: {
    // Fix webpack-dev-server deprecation warnings
    setupMiddlewares: (middlewares, devServer) => {
      // This replaces the deprecated onBeforeSetupMiddleware
      // and onAfterSetupMiddleware options
      return middlewares;
    },
  },
};
