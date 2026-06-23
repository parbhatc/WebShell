import { Router } from 'express';
import * as serverController from '../controllers/server.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/', serverController.getServers);
router.post('/:id/files/zip', serverController.zipFiles);
router.get('/:id/files/download', serverController.downloadFile);
router.get('/:id/files/content', serverController.readFileContent);
router.put('/:id/files/content', serverController.saveFileContent);
router.get('/:id/files', serverController.listFiles);
router.post('/:id/files', serverController.createFile);
router.delete('/:id/files', serverController.deleteFile);
router.patch('/:id/files', serverController.renameFile);
router.post('/', serverController.createServer);
router.put('/:id', serverController.updateServer);
router.delete('/:id', serverController.deleteServer);

export default router;
