import { initializeData } from './data';
import { blLog } from './logger';

initializeData()
	.then(() => {
		require('./http-ws-server');
	})
	.catch((err) => {
		blLog.error('Error initializing data:', err);
	});
