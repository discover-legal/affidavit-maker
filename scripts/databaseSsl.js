const net = require('node:net');
const tls = require('node:tls');

async function capturePinnedServerCertPEM(connectionString, expectedFingerprint) {
  const url = new URL(connectionString);
  const host = url.hostname;
  const port = Number(url.port || '5432');
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port });
    const fail = (error) => {
      try { socket.destroy(); } catch { /* ignore */ }
      reject(error);
    };
    socket.setTimeout(10_000, () => fail(new Error(`Timed out connecting to ${host}:${port}`)));
    socket.once('error', fail);
    socket.once('connect', () => {
      const request = Buffer.alloc(8);
      request.writeInt32BE(8, 0);
      request.writeInt32BE(80877103, 4);
      socket.write(request);
      socket.once('data', (data) => {
        if (data[0] !== 0x53) {
          fail(new Error(`Postgres at ${host}:${port} refused TLS`));
          return;
        }
        const tlsSocket = tls.connect({ socket, servername: host, rejectUnauthorized: false });
        tlsSocket.once('error', fail);
        tlsSocket.once('secureConnect', () => {
          try {
            const leaf = tlsSocket.getPeerCertificate(true);
            if (!leaf?.raw) throw new Error('Postgres presented no certificate');
            const actual = leaf.fingerprint256.replaceAll(':', '').toUpperCase();
            if (actual !== expectedFingerprint) {
              throw new Error(`Postgres certificate fingerprint mismatch for ${host}:${port}`);
            }
            const chunks = [];
            const seen = new Set();
            let cert = leaf;
            while (cert && !seen.has(cert.fingerprint256)) {
              seen.add(cert.fingerprint256);
              const body = cert.raw.toString('base64').match(/.{1,64}/g).join('\n');
              chunks.push(`-----BEGIN CERTIFICATE-----\n${body}\n-----END CERTIFICATE-----`);
              if (!cert.issuerCertificate || cert.issuerCertificate === cert) break;
              cert = cert.issuerCertificate;
            }
            tlsSocket.end();
            resolve(`${chunks.join('\n')}\n`);
          } catch (error) {
            fail(error);
          }
        });
      });
    });
  });
}

async function resolveMigrationSsl(env = process.env) {
  if (env.NODE_ENV !== 'production') return undefined;
  const ca = env.DATABASE_CA_CERT?.replace(/\\n/g, '\n').trim();
  if (ca) {
    if (!ca.includes('-----BEGIN CERTIFICATE-----') || !ca.includes('-----END CERTIFICATE-----')) {
      throw new Error('DATABASE_CA_CERT must contain one or more PEM certificates');
    }
    return { rejectUnauthorized: true, ca };
  }
  const fingerprint = env.DATABASE_CERT_SHA256?.replaceAll(':', '').trim().toUpperCase();
  if (!fingerprint) {
    throw new Error('Production migrations require DATABASE_CA_CERT or DATABASE_CERT_SHA256');
  }
  if (!/^[A-F0-9]{64}$/.test(fingerprint)) {
    throw new Error('DATABASE_CERT_SHA256 must be a 64-character SHA-256 fingerprint');
  }
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required in production');
  const pinned = await capturePinnedServerCertPEM(env.DATABASE_URL, fingerprint);
  return { rejectUnauthorized: true, ca: pinned, checkServerIdentity: () => undefined };
}

module.exports = { resolveMigrationSsl };
