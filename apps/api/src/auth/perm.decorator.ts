import { SetMetadata } from '@nestjs/common';
// 统一 metadata key
export const PERM_KEY = 'perm';
// 仅类型导入，避免运行时循环依赖
import type { AdminMenuKey } from './role.service.js';
export const RequirePerm = (perm: AdminMenuKey) => SetMetadata(PERM_KEY, perm);
