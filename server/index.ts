import { env, isProduction } from './env';
import { app } from './http';
import { seed } from './seed';

await seed();

app.listen(env.port, '0.0.0.0', () => {
  console.log(`Habsos ${isProduction() ? 'production' : 'development'} on http://localhost:${env.port}`);
});
