import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import {
  CreateDepartmentSchema, UpdateDepartmentSchema,
  AddDepartmentUserSchema, RemoveDepartmentUserSchema,
} from './departments.schema';
import * as ctrl from './departments.controller';

const router = Router();
router.use(authenticate);

router.get('/primary', ctrl.primaryList);
router.get('/', ctrl.list);
router.get('/:id', ctrl.getById);
router.get('/:id/users', ctrl.getUsers);
router.post('/', validate(CreateDepartmentSchema), ctrl.create);
router.put('/', validate(UpdateDepartmentSchema), ctrl.update);
router.post('/users/add', validate(AddDepartmentUserSchema), ctrl.addUser);
router.post('/users/remove', validate(RemoveDepartmentUserSchema), ctrl.removeUser);

export default router;
