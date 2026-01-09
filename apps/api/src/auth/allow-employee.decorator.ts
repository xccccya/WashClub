import { SetMetadata } from '@nestjs/common';

/**
 * 显式允许 employee（member token + enabled employee record）访问该接口。
 *
 * 设计原则：
 * - AdminOrEmployeeGuard 默认只对 admin 放行 + 权限校验
 * - 对 employee 必须“显式允许”，避免 guard 被误用导致员工越权访问管理接口
 */
export const ALLOW_EMPLOYEE_KEY = 'auth:allow-employee' as const;

export function AllowEmployee() {
	return SetMetadata(ALLOW_EMPLOYEE_KEY, true);
}

