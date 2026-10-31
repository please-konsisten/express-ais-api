import { web } from './application/web.js';
import { logger } from './application/logging.js';

web.get('/', (req, res) => {
  res.send('Test Hello');
});

web.listen(3000, () => {
  logger.info('App start');
});
