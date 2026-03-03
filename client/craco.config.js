module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Allow webpack to import ESM-only packages (e.g. react-markdown v10+)
      webpackConfig.module.rules.push({
        test: /\.m?js/,
        resolve: { fullySpecified: false }
      });
      return webpackConfig;
    }
  },
  devServer: (devServerConfig) => {
    // Remove deprecated middleware options and use setupMiddlewares instead
    delete devServerConfig.onBeforeSetupMiddleware;
    delete devServerConfig.onAfterSetupMiddleware;

    // Use the new setupMiddlewares option
    devServerConfig.setupMiddlewares = (middlewares, devServer) => {
      // Custom middleware setup can go here if needed
      return middlewares;
    };

    // Fix allowedHosts - filter out empty strings
    if (Array.isArray(devServerConfig.allowedHosts)) {
      devServerConfig.allowedHosts = devServerConfig.allowedHosts.filter(host => host && host.length > 0);
      if (devServerConfig.allowedHosts.length === 0) {
        devServerConfig.allowedHosts = 'all';
      }
    }

    return devServerConfig;
  },
};
