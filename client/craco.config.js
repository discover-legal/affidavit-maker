module.exports = {
  devServer: (devServerConfig) => {
    // Remove deprecated middleware options and use setupMiddlewares instead
    delete devServerConfig.onBeforeSetupMiddleware;
    delete devServerConfig.onAfterSetupMiddleware;

    // Use the new setupMiddlewares option
    devServerConfig.setupMiddlewares = (middlewares, devServer) => {
      // Custom middleware setup can go here if needed
      return middlewares;
    };

    return devServerConfig;
  },
};
