const isProduction = process.env.NODE_ENV === 'production'
  || Boolean(process.env.REPLIT_DEPLOYMENT)
  || Boolean(process.env.REPL_ID);

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const databaseUrl = required('DATABASE_URL');
const configuredJwtSecret = process.env.JWT_SECRET?.trim() || process.env.SESSION_SECRET?.trim();

if (isProduction && (!configuredJwtSecret || configuredJwtSecret.length < 32)) {
  throw new Error('JWT_SECRET or SESSION_SECRET must be set to at least 32 characters in production');
}

export const config = Object.freeze({
  appUrl: process.env.APP_URL?.trim() || 'https://cbo-app.replit.app',
  databaseUrl,
  isProduction,
  jwtSecret: configuredJwtSecret || 'development-only-secret-change-before-deploying',
  port: Number(process.env.PORT || 3001),
});
