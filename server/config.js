import crypto from 'node:crypto';

export function serverConfig(env = process.env) {
  const production = env.NODE_ENV === 'production' || env.RENDER === 'true';
  const secret = env.JWT_SECRET || (production ? '' : crypto.randomBytes(32).toString('hex'));
  if (secret.trim().length < 32) {
    throw new Error('JWT_SECRET is missing or shorter than 32 characters. In Render: service > Environment > add JWT_SECRET with a securely generated value > Save, rebuild, and deploy. Never put this secret in a VITE_ variable.');
  }
  const port = Number(env.PORT ?? 4000);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT must be a valid TCP port. On Render, use the PORT provided by the service.');
  return { port, host: '0.0.0.0', secret };
}
