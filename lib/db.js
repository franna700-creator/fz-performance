let sqlClientPromise;

function databaseUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
}

export async function getSql() {
  const url = databaseUrl();
  if (!url) throw new Error('database connection string is not configured');
  if (!sqlClientPromise) {
    sqlClientPromise = import('@neondatabase/serverless').then(({ neon }) => neon(url));
  }
  return sqlClientPromise;
}
