export class Auth0Client {
  async middleware() {
    return { status: 200, headers: new Headers() };
  }

  async getSession() {
    return null;
  }

  withPageAuthRequired<T>(handler: T): T {
    return handler;
  }

  withApiAuthRequired<T>(handler: T): T {
    return handler;
  }
}
