import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service.js';
import { PERM_KEY } from './perm.decorator.js';
import { extractBearerTokenFromHeaders } from './bearer.js';
import { ALLOW_EMPLOYEE_KEY } from './allow-employee.decorator.js';
 
@Injectable()
export class AdminOrEmployeeGuard implements CanActivate {
  constructor(
    private jwt: JwtService,
    private prisma: PrismaService,
    private reflector: Reflector,
  ) {}
 
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req: any = context.switchToHttp().getRequest();
    const token = extractBearerTokenFromHeaders(req?.headers);
    if (!token) throw new UnauthorizedException('未登录');
 
    let decoded: any;
    try {
      decoded = this.jwt.verify(token);
    } catch {
      throw new UnauthorizedException('登录已过期');
    }
 
    const type = String(decoded?.type || '');
    const sub = Number(decoded?.sub);
    if (!Number.isFinite(sub) || sub <= 0) throw new UnauthorizedException('身份无效');
 
    const requiredPerm = this.reflector.getAllAndOverride<string | undefined>(PERM_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const allowEmployee = !!this.reflector.getAllAndOverride<boolean | undefined>(ALLOW_EMPLOYEE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // ====== admin ======
    if (type === 'admin') {
      const user = await this.prisma.user.findUnique({ where: { id: sub }, include: { roleRef: true } });
      if (!user) throw new UnauthorizedException('账户不存在');
      if (user.roleId && user.roleRef && !user.roleRef.enabled) throw new ForbiddenException('该角色已被禁用');
      const permissions: string[] = Array.isArray(user.roleRef?.permissions) ? (user.roleRef?.permissions as any) : [];
 
      // 权限校验（与 AdminGuard 一致）
      if (requiredPerm) {
        if (!(permissions.includes('*') || permissions.includes(requiredPerm))) {
          throw new ForbiddenException('无权限');
        }
      }
 
      req.user = {
        id: user.id,
        roleId: user.roleId,
        role: user.role,
        phone: user.phone,
        name: user.name ?? '',
        avatarUrl: (user as any).avatarUrl ?? null,
        permissions,
        kind: 'admin',
      };
      return true;
    }
 
    // ====== employee (member token + enabled employee record) ======
    if (type === 'member') {
      const emp = await (this.prisma as any).employee.findUnique({ where: { memberId: sub }, select: { id: true, enabled: true } }).catch(() => null);
      if (!emp || !emp.enabled) throw new ForbiddenException('无权限');
      // 默认策略：employee 不能“隐式继承”后台权限键；除非显式标记允许
      if (requiredPerm && !allowEmployee) throw new ForbiddenException('无权限');
      // 注入一个轻量身份对象，便于后续扩展（例如记录 operator）
      req.user = { kind: 'employee', memberId: sub, employeeId: Number(emp.id) } as any;
      return true;
    }
 
    throw new UnauthorizedException('身份无效');
  }
}
 
