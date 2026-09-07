import { Router } from 'express';
import { SyncController } from '../controllers/sync.controller.js';

export function createSyncRouter(syncController: SyncController): Router {
  const router = Router();

  router.get('/pull', syncController.pull);
  router.post('/push', syncController.push);

  return router;
}
