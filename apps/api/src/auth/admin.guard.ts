import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service.js';
import { PERM_KEY } from './perm.decorator.js';

@Injectable()
export class AdminGuard implements CanActivate {
	constructor(private jwt: JwtService, private prisma: PrismaService, private reflector: Reflector) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const req: any = context.switchToHttp().getRequest();
		const authHeader: string | undefined = req?.headers?.authorization || req?.headers?.Authorization;
		if (!authHeader) throw new UnauthorizedException('未登录');
		const m = /^Bearer\s+(.+)$/.exec(String(authHeader));
		const token = m?.[1];
		if (!token) throw new UnauthorizedException('未登录');
		let decoded: any;
		try { decoded = this.jwt.verify(token); } catch { throw new UnauthorizedException('登录已过期'); }
		if (!decoded || decoded.type !== 'admin' || !decoded.sub) throw new UnauthorizedException('身份无效');
		const userId = Number(decoded.sub);
		if (!Number.isFinite(userId) || userId <= 0) throw new UnauthorizedException('身份无效');
		const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { roleRef: true } });
		if (!user) throw new UnauthorizedException('账户不存在');
		if (user.roleId && user.roleRef && !user.roleRef.enabled) throw new ForbiddenException('该角色已被禁用');
		// 权限校验
		const requiredPerm = this.reflector.getAllAndOverride<string | undefined>(PERM_KEY, [context.getHandler(), context.getClass()]);
		if (requiredPerm) {
			const perms: string[] = Array.isArray(user.roleRef?.permissions) ? (user.roleRef?.permissions as any) : [];
			if (!(perms.includes('*') || perms.includes(requiredPerm))) {
				throw new ForbiddenException('无权限');
			}
		}
		// 注入 request.user 便于后续使用
		req.user = { id: user.id, roleId: user.roleId, role: user.role };
		return true;
	}
}
